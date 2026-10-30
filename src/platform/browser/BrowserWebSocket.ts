import { IWebSocket, IWebSocketConfig } from '../IWebSocket';
import { Emits } from '../../utils/Emits';
import { IEventEmitter } from '../../utils/IEventEmitter';
import { EventEmitter } from '../../utils/EventEmitter';
import { generateConnectionToken } from '../../data-sync/utils';
import { StreamResponseEventType } from '../../data-sync/types';
import { IUser } from '../../options/IUser';
import { copyUser } from '../../utils/copyUser';

const socketConnectionIntervals = [1000, 3000, 5000, 7000, 11000, 13000, 30000, 60000];

class BrowserWebSocket implements IWebSocket {
  emitter: IEventEmitter = new EventEmitter();
  private ws?: WebSocket;
  private retryCounter = 0;
  private closed = false;
  private hasConnected = false;
  private generation = 0;
  private _config: IWebSocketConfig = {} as IWebSocketConfig;
  private livenessTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  identify(user: IUser): boolean {
    this._config.user = copyUser(user);
    this.retryCounter = 0;
    this.hasConnected = false;
    this.connect();
    return true;
  }

  connect() {
    this.clearTimers();
    const previous = this.ws;
    const generation = ++this.generation;
    this.ws = undefined;
    previous?.close(4003, 'Connection replaced');
    this.closed = false;
    const startTime = Date.now();
    const url = this._config.streamingUri.replace(/^http/, 'ws') + `?type=client&token=${generateConnectionToken(this._config.sdkKey)}`;
    const socket = new WebSocket(url);
    this.ws = socket;
    const isCurrent = () => !this.closed && this.generation === generation && this.ws === socket;

    socket.addEventListener('open', () => {
      if (!isCurrent()) return;
      this._config.logger.info(`WebSocket connection succeeded, connection time: ${Date.now() - startTime} ms`);
      this.hasConnected = true;
      this.retryCounter = 0;
      this.doDataSync();
      if (!isCurrent()) return;
      this.sendPingMessage(socket, isCurrent);
      this.bumpLiveness(socket, isCurrent);
    });
    socket.addEventListener('close', event => {
      if (!isCurrent()) return;
      this.clearTimers();
      this.ws = undefined;
      if (event.code !== 4003) this.reconnect(generation);
    });
    socket.addEventListener('error', () => {
      if (isCurrent() && !this.hasConnected) this.emitter.emit('network-error');
    });
    socket.addEventListener('message', event => {
      if (!isCurrent()) return;
      this.bumpLiveness(socket, isCurrent);
      try {
        const message = JSON.parse(event.data as string);
        if (message.messageType !== 'data-sync' || message.data?.userKeyId !== this._config.user.keyId) return;
        // The guard also rejects messages already queued when this connection is replaced.
        const guarded = { ...message, isCurrent };
        if (message.data.eventType === StreamResponseEventType.patch) this.emitter.emit('patch', guarded);
        else if (message.data.eventType === StreamResponseEventType.full) this.emitter.emit('put', guarded);
      } catch (error) {
        this._config.logger.warn('Ignoring an invalid WebSocket message', error);
      }
    });
  }

  close() {
    this.closed = true;
    ++this.generation;
    this.clearTimers();
    const socket = this.ws;
    this.ws = undefined;
    socket?.close(4003, 'The client is closed by user');
  }

  config(param: IWebSocketConfig) {
    if (param.emitter) this.emitter = param.emitter;
    this._config = { ...param, user: copyUser(param.user) };
  }

  private clearTimers() {
    clearTimeout(this.livenessTimer);
    clearTimeout(this.pingTimer);
    clearTimeout(this.reconnectTimer);
    this.livenessTimer = this.pingTimer = this.reconnectTimer = undefined;
  }

  private bumpLiveness(socket: WebSocket, isCurrent: () => boolean) {
    clearTimeout(this.livenessTimer);
    this.livenessTimer = setTimeout(() => {
      if (!isCurrent()) return;
      this._config.logger.warn('no server activity within timeout, recycling socket');
      socket.close();
    }, this._config.pingInterval * 2);
  }

  private sendPingMessage(socket: WebSocket, isCurrent: () => boolean) {
    clearTimeout(this.pingTimer);
    this.pingTimer = setTimeout(() => {
      if (!isCurrent() || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ messageType: 'ping', data: null }));
        this.sendPingMessage(socket, isCurrent);
      } catch (error) {
        this._config.logger.debug(error);
      }
    }, this._config.pingInterval);
  }

  private doDataSync(): boolean {
    try {
      if (this.ws?.readyState !== WebSocket.OPEN) return false;
      this.ws.send(JSON.stringify({
        messageType: 'data-sync',
        data: { timestamp: this._config.getStoreTimestamp(), user: this._config.user }
      }));
      return true;
    } catch (error) {
      this._config.logger.debug(error);
      return false;
    }
  }

  private reconnect(generation: number) {
    if (this.closed) return;
    const waitTime = socketConnectionIntervals[Math.min(this.retryCounter++, socketConnectionIntervals.length - 1)];
    this.reconnectTimer = setTimeout(() => {
      if (!this.closed && generation === this.generation) this.connect();
    }, waitTime);
  }
}

export default Emits(BrowserWebSocket);

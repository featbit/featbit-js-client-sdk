import { IWebSocket, IWebSocketConfig } from "../IWebSocket";
import { Emits } from "../../utils/Emits";
import { IEventEmitter } from "../../utils/IEventEmitter";
import { EventEmitter } from "../../utils/EventEmitter";
import { generateConnectionToken } from "../../data-sync/utils";
import { StreamResponseEventType } from "../../data-sync/types";
import { IUser } from "../../options/IUser";

const socketConnectionIntervals = [1000, 3000, 5000, 7000, 11000, 13000, 30000, 60000];

class BrowserWebSocket implements IWebSocket {
  emitter: IEventEmitter;
  private ws?: WebSocket;
  private retryCounter = 0;
  private closed: boolean = false;

  private _config: IWebSocketConfig = {} as IWebSocketConfig;

  constructor() {
    this.emitter = new EventEmitter();
  }

  identify(user: IUser) {
    this._config.user = user;
    this.doDataSync();
  }

  connect() {
    let that = this;
    const startTime = Date.now();
    const url = this._config.streamingUri.replace(/^http/, 'ws') + `?type=client&token=${ generateConnectionToken(this._config.sdkKey) }`;
    this.ws = new WebSocket(url);

    // Connection opened
    that.ws?.addEventListener('open', function (this: WebSocket, event) {
      // this is the websocket instance to which the current listener is binded to, it's different from that.socket
      that._config.logger.info(`WebSocket connection succeeded, connection time: ${ Date.now() - startTime } ms`);
      that.doDataSync();
      that.sendPingMessage();
    });

    // Connection closed
    that.ws?.addEventListener('close', function (event) {
      that._config.logger.warn('WebSocket closed');
      if (event.code === 4003) { // do not reconnect when 4003
        return;
      }

      that.reconnect();
    });

    // Connection error
    that.ws?.addEventListener('error', function (event) {
      // reconnect
      that._config.logger.debug('error');
    });

    // Listen for messages
    that.ws?.addEventListener('message', function (event) {
      const message = JSON.parse(event.data as string);
      if (message.messageType === 'data-sync') {
        switch (message.data.eventType) {
          case StreamResponseEventType.patch:
            that.emitter.emit('patch', message);
            break;
          case StreamResponseEventType.full:
            that.emitter.emit('put', message);
            break;
        }
      }
    });
  }

  close() {
    this.closed = true;
    this.ws?.close(4003, 'The client is closed by user');
    this.ws = undefined;
  }

  config(param: IWebSocketConfig) {
    if (param.emitter) {
      this.emitter = param.emitter;
    }

    this._config = {...param};
  }

  private sendPingMessage() {
    const payload = {
      messageType: 'ping',
      data: null
    };

    setTimeout(() => {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this._config.logger.debug('sending ping')
          this.ws.send(JSON.stringify(payload));
          this.sendPingMessage();
        } else {
          this._config.logger.debug(`socket closed at ${ new Date() }`);
        }
      } catch (err) {
        this._config.logger.debug(err);
      }
    }, this._config.pingInterval);
  }

  private doDataSync() {
    const payload = {
      messageType: 'data-sync',
      data: {
        timestamp: this._config.getStoreTimestamp(),
        user: this._config.user
      }
    };

    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._config.logger.debug('requesting data');
        this.ws?.send(JSON.stringify(payload));
      } else {
        this._config.logger.error(`not requesting data because socket not open`);
      }
    } catch (err) {
      this._config.logger.debug(err);
    }
  }

  private reconnect() {
    if (!this.closed) {
      this.ws = undefined;
      const waitTime = socketConnectionIntervals[Math.min(this.retryCounter++, socketConnectionIntervals.length - 1)];
      this._config.logger.info(`The client will try to reconnect in ${ waitTime } milliseconds.`);
      setTimeout(() => {
        this._config.logger.info(`The client is trying to reconnect, flag evaluation results may be stale until reconnected, waited for: ${ waitTime } milliseconds`);
        this.connect();
      }, waitTime);
    }
  }
}

export default Emits(BrowserWebSocket);
import { IDataSynchronizer } from "./IDataSynchronizer.js";
import ClientContext from "../options/ClientContext.js";
import { EventName, ProcessStreamResponse } from "./types.js";
import { ILogger } from "../logging/ILogger.js";
import { IWebSocketWithEvents } from "../platform/IWebSocket.js";
import { IUser } from "../options/IUser.js";
import { StoreItemOriginEnum } from "../store/index.js";
import { onPageResume } from '../utils/onPageResume.js';
import FullSyncPolicy from './FullSyncPolicy.js';
import { copyUser } from '../utils/copyUser.js';

class WebSocketDataSynchronizer implements IDataSynchronizer {
  private removeResumeListener?: () => void;
  private lastRefreshAttempt = 0;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private readonly socket: IWebSocketWithEvents;
  private readonly logger?: ILogger;
  private identifyResolve?: () => void;
  private identifyReject?: (error: Error) => void;
  private generation = 0;
  private stopped = false;
  private user: IUser;

  private connectionAttemptStartTime?: number;

  constructor(
    sdkKey: string,
    user: IUser,
    clientContext: ClientContext,
    socket: IWebSocketWithEvents,
    private readonly getStoreTimestamp: () => number,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    webSocketPingInterval: number,
    private readonly fullSync: FullSyncPolicy,
    private readonly onNetworkError?: () => void
  ) {
    const {logger, streamingUri} = clientContext;

    this.logger = logger;
    this.user = copyUser(user);
    this.socket = socket;
    this.socket.config({
      sdkKey,
      streamingUri,
      pingInterval: webSocketPingInterval,
      user,
      logger,
      getStoreTimestamp: () => {
        this.lastRefreshAttempt = Date.now();
        return this.fullSync.timestamp(getStoreTimestamp());
      }
    });

    this.listeners.forEach(({deserializeData, processJson}, eventName) => {
      this.socket.addListener(eventName, async (event) => {
        const generation = this.generation;
        const isCurrent = () => !this.stopped && generation === this.generation && (event?.isCurrent?.() ?? true);
        if (!isCurrent()) return;
        this.logger?.debug(`Received ${ eventName } event`);

        if (event?.data) {
          const {userKeyId} = event.data;
          if (userKeyId !== this.user.keyId || !Array.isArray(event.data.featureFlags)) return;
          try {
            const featureFlags = event.data.featureFlags.map((ff: any) => ({...ff, origin: StoreItemOriginEnum.Remote}));
            const data = deserializeData(featureFlags);
            await processJson(userKeyId, data, isCurrent);
            if (isCurrent()) {
              if (eventName === 'put') this.scheduleRefresh();
              this.identifyResolve?.();
              this.identifyResolve = undefined;
              this.identifyReject = undefined;
            }
          } catch (error) {
            if (isCurrent()) this.logger?.warn('Unable to process WebSocket response', error);
          }
        }
      });
    })

    if (this.onNetworkError) {
      this.socket.once('network-error', () => {
        if (this.stopped) return;
        this.logger?.warn('WebSocket connection failed, falling back to polling');
        this.onNetworkError!();
      });
    }
  }

  async identify(user: IUser): Promise<void> {
    this.stop();
    this.user = copyUser(user);
    this.stopped = false;
    this.lastRefreshAttempt = Date.now();
    this.watchResume();
    this.scheduleRefresh();
    return new Promise((resolve, reject) => {
      this.identifyResolve = resolve;
      this.identifyReject = reject;
      try {
        if (!this.socket.identify(this.user)) throw new Error('Websocket identify failed');
      } catch (error) {
        this.identifyResolve = undefined;
        this.identifyReject = undefined;
        reject(error);
      }
    });
  }

  start(): void {
    this.stopped = false;
    this.logConnectionStarted();

    this.lastRefreshAttempt = Date.now();
    this.socket.connect();
    this.watchResume();
    this.scheduleRefresh();
  }

  private watchResume(): void {
    this.removeResumeListener?.();
    this.removeResumeListener = onPageResume(() => {
      if (!this.stopped && this.fullSync.due && Date.now() - this.lastRefreshAttempt >= 30000) {
        this.lastRefreshAttempt = Date.now();
        this.socket.connect();
        this.scheduleRefresh();
      }
    });
  }

  private scheduleRefresh(): void {
    clearTimeout(this.refreshTimer);
    if (this.stopped) return;
    const generation = this.generation;
    this.refreshTimer = setTimeout(() => {
      if (this.stopped || generation !== this.generation) return;
      // Replacing the connection invalidates late responses and avoids parallel sync requests.
      // Check wall time here as background tabs may resume long after the timer was due.
      if (this.fullSync.due) {
        this.lastRefreshAttempt = Date.now();
        this.socket.connect();
      }
      this.scheduleRefresh();
    }, this.fullSync.delay);
  }

  private logConnectionStarted() {
    this.connectionAttemptStartTime = Date.now();
    this.logger?.info(`Stream connection attempt StartTime ${ this.connectionAttemptStartTime }`);
  }

  close(): void {
    this.stop();
  }

  stop(): void {
    this.stopped = true;
    this.removeResumeListener?.();
    this.removeResumeListener = undefined;
    clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
    ++this.generation;
    this.identifyReject?.(new Error('Identify superseded or synchronizer stopped'));
    this.identifyReject = undefined;
    this.identifyResolve = undefined;
    this.socket.close();
  }
}

export default WebSocketDataSynchronizer;

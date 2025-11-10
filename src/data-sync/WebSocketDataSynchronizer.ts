import { IDataSynchronizer } from "./IDataSynchronizer";
import ClientContext from "../options/ClientContext";
import { EventName, ProcessStreamResponse } from "./types";
import { ILogger } from "../logging/ILogger";
import { IWebSocketWithEvents } from "../platform/IWebSocket";
import { IUser } from "../options/IUser";
import { StoreItemOriginEnum } from "../store";

class WebSocketDataSynchronizer implements IDataSynchronizer {
  private socket?: IWebSocketWithEvents;
  private readonly logger?: ILogger;
  private identifyResolve?: () => void;

  private connectionAttemptStartTime?: number;

  constructor(
    sdkKey: string,
    user: IUser,
    clientContext: ClientContext,
    socket: IWebSocketWithEvents,
    private readonly getStoreTimestamp: () => number,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    webSocketPingInterval: number
  ) {
    const {logger, streamingUri} = clientContext;

    this.logger = logger;
    this.socket = socket;
    this.socket.config({
      sdkKey,
      streamingUri,
      pingInterval: webSocketPingInterval,
      user,
      logger,
      getStoreTimestamp
    });

    this.listeners.forEach(({deserializeData, processJson}, eventName) => {
      this.socket?.addListener(eventName, async (event) => {
        this.logger?.debug(`Received ${ eventName } event`);

        if (event?.data) {
          const {userKeyId} = event.data;
          // set origin
          const featureFlags =  event.data.featureFlags.map((ff: any) => ({...ff, origin: StoreItemOriginEnum.Remote}));
          const data = deserializeData(featureFlags);
          await processJson(userKeyId, data);
          this.identifyResolve?.();
          this.identifyResolve = undefined;
        }
      });
    })
  }

  async identify(user: IUser): Promise<void> {
    this.socket?.identify(user);
    return new Promise(resolve => this.identifyResolve = resolve);
  }

  start(): void {
    this.logConnectionStarted();

    this.socket?.connect();
  }

  private logConnectionStarted() {
    this.connectionAttemptStartTime = Date.now();
    this.logger?.info(`Stream connection attempt StartTime ${ this.connectionAttemptStartTime }`);
  }

  close(): void {
    this.stop();
  }

  stop(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}

export default WebSocketDataSynchronizer;
import { IDataSynchronizer } from "./IDataSynchronizer";
import ClientContext from "../options/ClientContext";
import { EventName, ProcessStreamResponse } from "./types";
import { ILogger } from "../logging/ILogger";
import { IWebSocketWithEvents } from "../platform/IWebSocket";
import { IUser } from "../options/IUser";

class WebSocketDataSynchronizer implements IDataSynchronizer {
  private socket?: IWebSocketWithEvents;
  private readonly logger?: ILogger;

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
      this.socket?.addListener(eventName, (event) => {
        this.logger?.debug(`Received ${ eventName } event`);

        if (event?.data) {
          const {featureFlags, userKeyId} = event.data;
          const data = deserializeData(featureFlags);
          processJson(userKeyId, data);
        }
      });
    })
  }

  identify(user: IUser): void {
    this.socket?.identify(user);
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
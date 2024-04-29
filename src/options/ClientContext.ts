import { ILogger } from "../logging/ILogger";
import { IPlatform } from "../platform/IPlatform";
import { IClientContext } from "./IClientContext";
import { IUser } from "./IUser";

/**
 * The client context provides basic configuration and platform support which are required
 * when building SDK components.
 */
export default class ClientContext implements IClientContext {
  flushInterval: number;
  maxEventsInQueue: number;
  offline: boolean;
  logger: ILogger;
  eventsUri: string;
  pollingUri: string;
  streamingUri: string;

  constructor(
    public readonly sdkKey: string,
    configuration: {
      logger?: ILogger;
      offline?: boolean;
      flushInterval: number;
      maxEventsInQueue: number;
      streamingUri: string;
      pollingUri: string;
      eventsUri: string;
    },
    public readonly platform: IPlatform,
  ) {
    this.logger = configuration.logger!;
    this.offline = configuration.offline!;
    this.flushInterval = configuration.flushInterval;
    this.maxEventsInQueue = configuration.maxEventsInQueue;
    this.streamingUri = configuration.streamingUri;
    this.pollingUri = configuration.pollingUri;
    this.eventsUri = configuration.eventsUri;
  }
}
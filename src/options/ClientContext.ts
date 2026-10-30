import { ILogger } from "../logging/ILogger.js";
import { IPlatform } from "../platform/IPlatform.js";
import { IClientContext } from "./IClientContext.js";
import { IUser } from "./IUser.js";

/**
 * The client context provides basic configuration and platform support which are required
 * when building SDK components.
 */
export default class ClientContext implements IClientContext {
  fullSyncInterval?: number;
  maxCachedUsers?: number;
  userCacheTtl?: number;
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
      fullSyncInterval?: number;
      maxCachedUsers?: number;
      userCacheTtl?: number;
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
    this.fullSyncInterval = configuration.fullSyncInterval;
    this.maxCachedUsers = configuration.maxCachedUsers;
    this.userCacheTtl = configuration.userCacheTtl;
    this.offline = configuration.offline!;
    this.flushInterval = configuration.flushInterval;
    this.maxEventsInQueue = configuration.maxEventsInQueue;
    this.streamingUri = configuration.streamingUri;
    this.pollingUri = configuration.pollingUri;
    this.eventsUri = configuration.eventsUri;
  }
}

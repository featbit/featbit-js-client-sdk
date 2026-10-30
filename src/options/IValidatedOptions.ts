import { ILogger } from "../logging/ILogger.js";
import { IStore } from "../platform/IStore.js";
import { IOptions } from "./IOptions.js";
import { IDataSynchronizer } from "../data-sync/IDataSynchronizer.js";
import { DataSyncModeEnum } from "../data-sync/DataSyncMode.js";
import { IUser } from "./IUser.js";
import { IFlagBase } from "../evaluation/index.js";

export interface IValidatedOptions {
  fullSyncInterval: number;
  maxCachedUsers: number;
  userCacheTtl: number;
  startWaitTime: number;
  sdkKey: string;
  pollingUri: string;
  streamingUri: string;
  eventsUri: string;
  dataSyncMode: DataSyncModeEnum;
  webSocketPingInterval?: number;
  flushInterval: number;
  maxEventsInQueue: number;
  disableEvents: boolean;
  pollingInterval: number;
  offline: boolean;
  enablePollingFallback: boolean;
  store: IStore | ((options: IOptions) => IStore);
  dataSynchronizer?: IDataSynchronizer;
  logger?: ILogger;
  user?: IUser;
  bootstrap?: IFlagBase[];

  // Allow indexing this by a string for the validation step.
  [index: string]: any;
}

import { ILogger } from "../logging/ILogger";
import { IStore } from "../platform/IStore";
import { IOptions } from "./IOptions";
import { IDataSynchronizer } from "../data-sync/IDataSynchronizer";
import { DataSyncModeEnum } from "../data-sync/DataSyncMode";
import { IUser } from "./IUser";
import { IBootstrapProvider } from "../bootstrap";
import { IFlagBase } from "../evaluation";

export interface IValidatedOptions {
  startWaitTime: number;
  sdkKey: string;
  pollingUri: string;
  streamingUri: string;
  eventsUri: string;
  dataSyncMode: DataSyncModeEnum;
  webSocketPingInterval?: number;
  flushInterval: number;
  maxEventsInQueue: number;
  pollingInterval: number;
  offline: boolean;
  store: IStore | ((options: IOptions) => IStore);
  dataSynchronizer?: IDataSynchronizer;
  logger?: ILogger;
  user?: IUser;
  bootstrap?: IFlagBase[];

  // Allow indexing this by a string for the validation step.
  [index: string]: any;
}
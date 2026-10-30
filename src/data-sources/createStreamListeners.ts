import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import { ILogger } from "../logging/ILogger";
import { VoidFunction } from "../utils/VoidFunction";
import {
  deserializeAll,
  deserializePatch,
  IPatchData,
  Flags
} from "../store/serialization";
import { IStoreDataStorage } from "../store/store";
import { EventName, ProcessStreamResponse } from "../data-sync/types";

const createPutListener = (
  dataSourceUpdates: IDataSourceUpdates,
  logger?: ILogger,
  onPutCompleteHandler: VoidFunction = () => {
  },
) => ({
  deserializeData: deserializeAll,
  processJson: async (userKeyId: string, {flags}: Flags, isCurrent = () => true) => {
    if (!isCurrent()) return;
    const initData: IStoreDataStorage = {
      flags: flags,
      version: 0
    };

    logger?.debug('Initializing all data');
    await dataSourceUpdates.init(userKeyId, initData, () => {
      if (isCurrent()) onPutCompleteHandler();
    }, isCurrent);
  },
});

const createPatchListener = (
  dataSourceUpdates: IDataSourceUpdates,
  onPatchCompleteHandler: VoidFunction = () => {
  },
) => ({
  deserializeData: deserializePatch,
  processJson: async (userKeyId: string, data: IPatchData[], isCurrent = () => true) => {
    if (!isCurrent()) return;
    await dataSourceUpdates.upsertBatch(userKeyId, data, () => {
      if (isCurrent()) onPatchCompleteHandler();
    }, isCurrent);
  },
});


export const createStreamListeners = (
  dataSourceUpdates: IDataSourceUpdates,
  logger?: ILogger,
  onCompleteHandlers?: {
    put?: VoidFunction;
    patch?: VoidFunction;
    delete?: VoidFunction;
  },
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(dataSourceUpdates, logger, onCompleteHandlers?.put));
  listeners.set('patch', createPatchListener(dataSourceUpdates, onCompleteHandlers?.patch));
  return listeners;
};

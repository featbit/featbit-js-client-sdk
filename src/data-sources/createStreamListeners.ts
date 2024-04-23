import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import { ILogger } from "../logging/ILogger";
import { VoidFunction } from "../utils/VoidFunction";
import {
  deserializeAll,
  deserializePatch,
  IPatchData,
  Flags
} from "../store/serialization";
import DataKinds from "../store/DataKinds";
import { IStoreDataStorage } from "../store/store";
import { EventName, ProcessStreamResponse } from "../data-sync/types";

export const createPutListener = (
  dataSourceUpdates: IDataSourceUpdates,
  logger?: ILogger,
  onPutCompleteHandler: VoidFunction = () => {
  },
) => ({
  deserializeData: deserializeAll,
  processJson: async (userKeyId: string, {flags}: Flags) => {
    const initData: IStoreDataStorage = {
      flags: flags,
      version: 0
    };

    logger?.debug('Initializing all data');
    dataSourceUpdates.init(userKeyId, initData, onPutCompleteHandler);
  },
});

export const createPatchListener = (
  dataSourceUpdates: IDataSourceUpdates,
  logger?: ILogger,
  onPatchCompleteHandler: VoidFunction = () => {
  },
) => ({
  deserializeData: deserializePatch,
  processJson: async (userKeyId: string, data: IPatchData[]) => {
    if (data?.length === 0) {
      onPatchCompleteHandler?.();
      return;
    }

    data?.forEach(item => {
      logger?.debug(`Updating ${ item.data.key } in ${ item.kind.namespace }`);
      dataSourceUpdates.upsert(userKeyId, item.kind, item.data, onPatchCompleteHandler);
    })
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
  listeners.set('patch', createPatchListener(dataSourceUpdates, logger, onCompleteHandlers?.patch));
  return listeners;
};

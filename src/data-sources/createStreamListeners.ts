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
  processJson: async (userKeyId: string, {flags}: Flags) => {
    const initData: IStoreDataStorage = {
      flags: flags,
      version: 0
    };

    logger?.debug('Initializing all data');
    await dataSourceUpdates.init(userKeyId, initData, onPutCompleteHandler);
  },
});

const createPatchListener = (
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

    if (data?.length > 0) {
      for(const item of data) {
        logger?.debug(`Updating ${ item.data.key } in ${ item.kind.namespace }`);
        await dataSourceUpdates.upsert(userKeyId, item.kind, item.data, onPatchCompleteHandler);
      }
    }
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

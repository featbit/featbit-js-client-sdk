import {featureFlagEvaluatedTopic} from "./constants";
import {eventHub} from "./events";
import {logger} from "./logger";
import {
  FeatureFlagUpdateOperation, FeatureFlagValue,
  IDataStore,
  IFeatureFlag,
  IFeatureFlagChange,
  InsightType
} from "./types";
import {parseVariation} from "./utils";

const DataStoreStorageKey = 'fb-datastore';

class Store {
  private _userId: string | null = null;

  private _store: IDataStore = {
    featureFlags: {} as { [key: string]: IFeatureFlag }
  }

  constructor() { }

  set userId(id: string) {
    this._userId = id;
    this._loadFromStorage();
  }

  getFeatureFlag(key: string): IFeatureFlag {
    return this._store.featureFlags[key];
  }

  getVariation(key: string): FeatureFlagValue {
    const featureFlag = this._store.featureFlags[key];

    if (!featureFlag) {
      return undefined;
    }

    eventHub.emit(featureFlagEvaluatedTopic, {
      insightType: InsightType.featureFlagUsage,
      id: featureFlag.id,
      timestamp: Date.now(),
      sendToExperiment: featureFlag.sendToExperiment,
      variation: featureFlag.variationOptions.find(o => o.value === featureFlag.variation)
    });

    const { variationType, variation } = featureFlag;

    return parseVariation(variationType, variation);
  }

  setFullData(data: IDataStore) {
    this._store = {
      featureFlags: {} as { [key: string]: IFeatureFlag }
    };

    this._dumpToStorage(this._store);
    this.updateBulkFromRemote(data);
  }

  getFeatureFlags(): { [key: string]: IFeatureFlag } {
    return this._store.featureFlags;
  }

  updateStorageBulk(data: IDataStore, storageKey: string, onlyInsertNewElement: boolean) {
    let dataStoreStr = localStorage.getItem(storageKey);
    let store: IDataStore | null = null;

    try {
      if (dataStoreStr && dataStoreStr.trim().length > 0) {
        store = JSON.parse(dataStoreStr);
      }
    } catch (err) {
      logger.logDebug(`error while loading local data store: ${storageKey}` + err);
    }

    if (!!store) {
      const { featureFlags } = data;

      Object.keys(featureFlags).forEach(id => {
        const remoteFf = featureFlags[id];
        const localFf = store!.featureFlags[id];

        const predicate = !localFf || !onlyInsertNewElement;
        if (predicate) {
          store!.featureFlags[remoteFf.id] = Object.assign({}, remoteFf);
        }
      });

      this._dumpToStorage(store, storageKey);
    }
  }

  updateBulkFromRemote(data: IDataStore) {
    const storageKey = `${DataStoreStorageKey}-${this._userId}`;

    this.updateStorageBulk(data, storageKey, false);

    this._loadFromStorage();
  }

  private _emitUpdateEvents(updatedFeatureFlags: any[]): void {
    if (updatedFeatureFlags.length > 0) {
      updatedFeatureFlags.forEach(({ id, operation, data }) => eventHub.emit(`ff_${operation}:${data.id}`, data));
      eventHub.emit(`ff_${FeatureFlagUpdateOperation.update}`, updatedFeatureFlags.map(item => item.data));
    }
  }

  private _dumpToStorage(store?: IDataStore, localStorageKey?: string): void {
    if (store) {
      const storageKey = localStorageKey || `${DataStoreStorageKey}-${this._userId}`;
      localStorage.setItem(storageKey, JSON.stringify(store));
      return;
    }
    const storageKey = `${DataStoreStorageKey}-${this._userId}`;
    localStorage.setItem(storageKey, JSON.stringify(this._store));
  }

  private _loadFromStorage(): void {
    try {
      const storageKey = `${DataStoreStorageKey}-${this._userId}`;
      let dataStoreStr = localStorage.getItem(storageKey);

      let shouldDumpToStorage = false;

      if (dataStoreStr && dataStoreStr.trim().length > 0) {
        // compare _store and dataStoreStr data and send notification if different
        const storageData: IDataStore = JSON.parse(dataStoreStr);

        const updatedFeatureFlags = Object.keys(storageData.featureFlags).filter(key => {
          const storageFf = storageData.featureFlags[key];
          const ff = this._store.featureFlags[key];
          return !ff || storageFf.variation !== ff.variation || storageFf.variationType !== ff.variationType;
        }).map(key => {
          const storageFf = storageData.featureFlags[key];
          const ff = this._store.featureFlags[key];

          return {
            id: key,
            operation: FeatureFlagUpdateOperation.update,
            sendToExperiment: storageFf.sendToExperiment,
            data: {
              id: key,
              oldValue: ff ? parseVariation(ff.variationType, ff.variation): undefined,
              newValue: parseVariation(storageFf.variationType, storageFf.variation)
            } as IFeatureFlagChange
          }
        });

        this._store = storageData;
        this._emitUpdateEvents(updatedFeatureFlags);
      } else {
        this._store = {
          featureFlags: {} as { [key: string]: IFeatureFlag }
        };
      }

      if (shouldDumpToStorage) {
        this._dumpToStorage();
      }

    } catch (err) {
      logger.logDebug('error while loading local data store: ' + err);
    }
  }
}

export default new Store();
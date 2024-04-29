import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import {
  IStoreDataStorage,
  IStoreItem,
  IKeyedStoreItem
} from "../store/store";
import { IStore } from "../platform/IStore";
import { IDataKind } from "../IDataKind";
import DataKinds from "../store/DataKinds";

/**
 * @internal
 */
export default class DataSourceUpdates implements IDataSourceUpdates {

  constructor(
    private readonly store: IStore,
    private readonly hasEventListeners: () => boolean,
    private readonly onChange: (keys: string[]) => void,
  ) {
  }

  init(userKeyId: string, allData: IStoreDataStorage, callback?: () => void): void {
    if (userKeyId !== this.store.user.keyId) {
      callback?.();
      return;
    }

    const checkForChanges = this.hasEventListeners();
    const doInit = (oldData?: IStoreDataStorage) => {
      this.store.init(allData, () => {
        // Defer change events so they execute after the callback.
        Promise.resolve().then(() => {
          if (checkForChanges) {
            const updatedKeys = Object.keys(allData)
              .flatMap((namespace) => {
                const oldDataForKind = oldData?.[namespace] || {};
                const newDataForKind = allData[namespace];
                const mergedData = {...oldDataForKind, ...newDataForKind};
                return Object.keys(mergedData)
                  .filter((key: string) => this.isUpdated(oldDataForKind && oldDataForKind[key], newDataForKind && newDataForKind[key]));
              });
            updatedKeys.length > 0 && this.onChange(updatedKeys);
          }
        });
        callback?.();
      });
    };

    if (checkForChanges) {
      const [flags, version] = this.store.all(DataKinds.Flags);
      const oldData = {
        flags,
        version
      };
      doInit(oldData);
    } else {
      doInit();
    }
  }

  upsert(userKeyId: string, kind: IDataKind, data: IKeyedStoreItem, callback: () => void): void {
    if (userKeyId !== this.store.user.keyId) {
      callback?.();
      return;
    }

    const {key} = data;
    const checkForChanges = this.hasEventListeners();
    const doUpsert = (oldItem?: IStoreItem) => {
      this.store.upsert(kind, data, () => {
        // Defer change events so they execute after the callback.
        Promise.resolve().then(() => {
          if (checkForChanges && this.isUpdated(oldItem, data[key])) {
            this.onChange([key]);
          }
        });

        callback?.();
      });
    };
    if (checkForChanges) {
      const item = this.store.get(kind, key);
      doUpsert(item || undefined);
    } else {
      doUpsert();
    }
  }

  private isUpdated(oldData?: IStoreItem, newData?: IStoreItem): boolean {
    return !oldData || !newData || newData.version > oldData.version
  }
}
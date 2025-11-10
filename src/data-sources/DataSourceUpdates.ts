import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import { IKeyedStoreItem, IStoreDataStorage, IStoreItem, StoreItemOriginEnum } from "../store/store";
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

  async init(userKeyId: string, newData: IStoreDataStorage, callback?: () => void): Promise<void> {
    if (userKeyId !== this.store.user.keyId) {
      callback?.();
      return;
    }

    const checkForChanges = this.hasEventListeners();
    const doInit = async (oldData?: IStoreDataStorage) => {
      // When init method is not run from local bootstrap and if bootstrap data is configured when starting the app and the server does not return those flags
      // We should keep the local flags in the store as it is
      const isRunFromLocal = Object.keys(newData.flags).some((key) => newData.flags[key].origin === StoreItemOriginEnum.Local);
      if (!isRunFromLocal && oldData) {
        const localOnlyFlags = Object.keys(oldData.flags).filter((key: string) => {
          return oldData.flags[key] && !newData.flags[key] && oldData.flags[key].origin === StoreItemOriginEnum.Local;
        }).reduce((acc: {[attribute: string]: any}, cur: string) => {
          acc[cur] = oldData.flags[cur];
          return acc;
        }, {});

        newData = { version: newData.version, flags: {...newData.flags, ...localOnlyFlags}};
      }

      await this.store.init(newData);

      Promise.resolve().then(() => {
        if (checkForChanges) {
          const updatedKeys = Object.keys(newData)
            .flatMap((namespace) => {
              const oldDataForKind = oldData?.[namespace] || {};
              const newDataForKind = newData[namespace];
              const mergedData = {...oldDataForKind, ...newDataForKind};
              return Object.keys(mergedData)
                .filter((key: string) => this.isUpdated(oldDataForKind && oldDataForKind[key], newDataForKind && newDataForKind[key]));
            });
          updatedKeys.length > 0 && this.onChange(updatedKeys);
        }
      });
      callback?.();
    };

    const [flags, version] = this.store.all(DataKinds.Flags);
    const oldData = {
      flags,
      version
    };
    await doInit(oldData);
  }

  checkUpdates(oldData: IStoreDataStorage, newData: IStoreDataStorage, callback?: () => void): void {
    const checkForChanges = this.hasEventListeners();

    if (!checkForChanges) {
      return;
    }

    const updatedKeys = Object.keys(newData)
    .flatMap((namespace) => {
      const oldDataForKind = oldData?.[namespace] || {};
      const newDataForKind = newData[namespace];
      const mergedData = {...oldDataForKind, ...newDataForKind};
      return Object.keys(mergedData)
      .filter((key: string) => this.isUpdated(oldDataForKind && oldDataForKind[key], newDataForKind && newDataForKind[key]));
    });
    updatedKeys.length > 0 && this.onChange(updatedKeys);

    callback?.();
  }

  async upsert(userKeyId: string, kind: IDataKind, data: IKeyedStoreItem, callback: () => void): Promise<void> {
    if (userKeyId !== this.store.user.keyId) {
      callback?.();
      return;
    }

    const {key} = data;
    const checkForChanges = this.hasEventListeners();
    const doUpsert = async (oldItem?: IStoreItem) => {
      await this.store.upsert(kind, data);
      Promise.resolve().then(() => {
        if (checkForChanges && this.isUpdated(oldItem, data[key])) {
          this.onChange([key]);
        }
      });

      callback?.();
    };
    if (checkForChanges) {
      const item = this.store.get(kind, key);
      await doUpsert(item || undefined);
    } else {
      await doUpsert();
    }
  }

  private isUpdated(oldData?: IStoreItem, newData?: IStoreItem): boolean {
    if (!oldData && !newData) {
      return false;
    }

    if (!oldData || !newData) {
      return true;
    }

    return newData.version >= oldData.version && newData.variation !== oldData.variation;
  }
}
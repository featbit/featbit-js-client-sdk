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

  init(userKeyId: string, newData: IStoreDataStorage): void {
    if (userKeyId !== this.store.user.keyId) {
      return;
    }

    const checkForChanges = this.hasEventListeners();
    const doInit = (oldData?: IStoreDataStorage) => {
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

      this.store.init(newData);

      Promise.resolve().then(() => {
        if (checkForChanges) {
          const updatedKeys = Object.keys(newData)
            .filter((key) => key !== 'version')
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
    };

    const [flags, version] = this.store.all(DataKinds.Flags);
    const oldData = {
      flags,
      version
    };
    doInit(oldData);
  }

  checkUpdates(oldData: IStoreDataStorage, newData: IStoreDataStorage): void {
    const checkForChanges = this.hasEventListeners();

    if (!checkForChanges) {
      return;
    }

    const updatedKeys = Object.keys(newData)
    .filter((key) => key !== 'version')
    .flatMap((namespace) => {
      const oldDataForKind = oldData?.[namespace] || {};
      const newDataForKind = newData[namespace];
      const mergedData = {...oldDataForKind, ...newDataForKind};
      return Object.keys(mergedData)
      .filter((key: string) => this.isUpdated(oldDataForKind && oldDataForKind[key], newDataForKind && newDataForKind[key]));
    });
    updatedKeys.length > 0 && this.onChange(updatedKeys);
  }

  upsert(userKeyId: string, kind: IDataKind, data: IKeyedStoreItem): void {
    if (userKeyId !== this.store.user.keyId) {
      return;
    }

    const {key} = data;
    const checkForChanges = this.hasEventListeners();
    const doUpsert = (oldItem?: IStoreItem) => {
      this.store.upsert(kind, data);
      Promise.resolve().then(() => {
        if (checkForChanges && this.isUpdated(oldItem, data)) {
          this.onChange([key]);
        }
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
    if (!oldData && !newData) {
      return false;
    }

    if (!oldData || !newData) {
      return true;
    }

    return newData.version >= oldData.version && newData.variation !== oldData.variation;
  }
}

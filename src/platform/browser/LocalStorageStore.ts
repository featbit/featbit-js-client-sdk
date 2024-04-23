import { IDataKind } from "../../IDataKind";
import {
  StoreStorageKey,
  IKeyedStoreItem,
  IStoreDataStorage,
  IStoreItem,
  IStoreKindData,
  CurrentUserStorageKey
} from "../../store/store";
import { IStore } from "../../platform/IStore";
import { IUser } from "../../options/IUser";
import { ILogger } from "../../logging/ILogger";
import { IOptions } from "../../options/IOptions";
import { serializeUser } from "../../utils/serializeUser";

export default class LocalStorageStore implements IStore {
  private store: IStoreDataStorage  = {} as IStoreDataStorage;

  private initCalled = false;

  private _user: IUser = {} as IUser;

  private logger: ILogger;

  constructor(options: IOptions) {
    this.logger = options.logger!;
  }

  identify(user: IUser) {
    this._user = {...user};

    localStorage.setItem(CurrentUserStorageKey, serializeUser(this._user));
    this.loadStoreFromStorage();
  }

  get user(): IUser {
    return this._user;
  }

  private addItem(kind: IDataKind, key: string, item: IStoreItem) {
    let items = this.store[kind.namespace];
    if (!items) {
      items = {};
      this.store[kind.namespace] = items;
    }
    if (Object.hasOwnProperty.call(items, key)) {
      const old = items[key];
      if (!old || old.version < item.version) {
        items[key] = item;
      }
    } else {
      items[key] = item;
    }

    if (item.version > this.store.version) {
      this.store.version = item.version;
    }

    this.dumpStoreToStorage();
  }

  get(kind: IDataKind, key: string): IStoreItem | null {
    const items = this.store[kind.namespace];
    if (items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        const item = items[key];
        if (item) {
          return item;
        }
      }
    }
    return null;
  }

  all(kind: IDataKind): [IStoreKindData, number] {
    const result: IStoreKindData = {};
    const items = this.store[kind.namespace] ?? {};
    Object.entries(items).forEach(([key, item]) => {
      if (item) {
        result[key] = <IStoreItem>item;
      }
    });

    return [result, this.store.version];
  }

  init(allData: IStoreDataStorage, callback: () => void): void {
    this.store = allData as IStoreDataStorage;

    Object.keys(allData).map(namespace => {
      Object.entries(allData[namespace]).forEach(([_, item]) => {
        const ele = item as IStoreItem;
        if (ele.version > this.store.version) {
          this.store.version = ele.version;
        }
      })
    });

    this.dumpStoreToStorage();
    this.initCalled = true;
    callback?.();
  }

  upsert(kind: IDataKind, data: IKeyedStoreItem, callback: () => void): void {
    this.addItem(kind, data.key, data);
    callback?.();
  }

  initialized(): boolean {
    return this.initCalled;
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the memory store this is a no-op.
  }

  getDescription(): string {
    return 'local-storage-store'
  }

  get version(): number {
    return this.store.version;
  }

  private dumpStoreToStorage(): void {
    const storageKey = `${StoreStorageKey}-${this._user.keyId}`;
    localStorage.setItem(storageKey, JSON.stringify(this.store));
  }

  private loadStoreFromStorage(): void {
    const storageKey = `${StoreStorageKey}-${this._user.keyId}`;
    const dataStoreStr = localStorage.getItem(storageKey);
    let store: IStoreDataStorage | null = null;

    try {
      if (dataStoreStr && dataStoreStr.trim().length > 0) {
        store = JSON.parse(dataStoreStr);
      }
    } catch (err) {
      this.logger.error(`error while loading local data store: ${storageKey}`, err);
    }

    if (!!store) {
      this.store = store;
    } else {
      this.store = {
        flags: {},
        version: 0
      };
    }
  }
}
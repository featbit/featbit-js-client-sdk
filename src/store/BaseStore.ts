import { IStore } from "../platform";
import { IKeyedStoreItem, IStoreDataStorage, IStoreItem, IStoreKindData } from "./store";
import { IUser } from "../options";
import { IDataKind } from "../IDataKind";

export class BaseStore implements IStore {
  protected store: IStoreDataStorage  = {} as IStoreDataStorage;

  protected initCalled = false;

  protected _user: IUser = {} as IUser;

  constructor() {
  }

  async identify(user: IUser) {
    this._user = {...user};

    await this.saveUser();
    await this.loadStoreFromStorage();
  }

  get user(): IUser {
    return this._user;
  }

  protected async addItem(kind: IDataKind, key: string, item: IStoreItem) {
    let items = this.store[kind.namespace];
    if (!items) {
      items = {};
      this.store[kind.namespace] = items;
    }
    if (Object.hasOwnProperty.call(items, key)) {
      const old = items[key];
      // we use <= here, the reason is that when a segment is changed, the upstream service would push the flag
      // to client SDK with flag timestamp (version) instead of segment timestamp, so to ensure that the new flag value
      // is saved, we need to use <=
      if (!old || old.version <= item.version) {
        items[key] = item;
      }
    } else {
      items[key] = item;
    }

    if (item.version > this.store.version) {
      this.store.version = item.version;
    }

    await this.dumpStoreToStorage();
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

  async init(allData: IStoreDataStorage) {
    this.store = allData as IStoreDataStorage;

    Object.keys(allData).map(namespace => {
      Object.entries(allData[namespace]).forEach(([_, item]) => {
        const ele = item as IStoreItem;
        if (ele.version > this.store.version) {
          this.store.version = ele.version;
        }
      })
    });

    await this.dumpStoreToStorage();
    this.initCalled = true;
  }

  async upsert(kind: IDataKind, data: IKeyedStoreItem) {
    await this.addItem(kind, data.key, data);
  }

  initialized(): boolean {
    return this.initCalled;
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the LocalStorage store this is a no-op.
  }

  get version(): number {
    return this.store.version;
  }

  // This getter needs to be overridden in the child class
  get description(): string {
    return '';
  }

  // This method needs to be overridden in the child class
  protected async saveUser(): Promise<void> {
  }

  // This method needs to be overridden in the child class
  protected async loadStoreFromStorage(): Promise<void> {
  }

  // This method needs to be overridden in the child class
  protected async dumpStoreToStorage(): Promise<void> {
  }
}
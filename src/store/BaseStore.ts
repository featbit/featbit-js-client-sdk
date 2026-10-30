import { IStore } from "../platform/index.js";
import { IKeyedStoreItem, IStoreDataStorage, IStoreItem, IStoreKindData, IStoreUpdate, StoreItemOriginEnum } from "./store.js";
import { IUser } from "../options/index.js";
import { IDataKind } from "../IDataKind.js";
import DataKinds from "./DataKinds.js";
import { copyUser } from '../utils/copyUser.js';

export class BaseStore implements IStore {
  protected store: IStoreDataStorage = { flags: {}, version: 0 };

  protected initCalled = false;

  protected _user: IUser = {} as IUser;
  protected contextGeneration = 0;

  constructor() {
  }

  async identify(user: IUser) {
    const generation = ++this.contextGeneration;
    this._user = copyUser(user);
    this.store = { flags: {}, version: 0 };
    this.initCalled = false;

    await this.saveUser();
    if (generation !== this.contextGeneration) return;

    // load version
    await this.loadStoreFromStorage();
  }

  get user(): IUser {
    return this._user;
  }

  private compactArchivedFlag(key: string, item: IStoreItem): IStoreItem {
    if (item.matchReason !== 'flag archived') {
      return item;
    }

    // Keep the version even though normal reads hide this record. Otherwise an
    // older patch could resurrect the flag after its full data has been removed.
    return {
      key,
      version: item.version,
      origin: item.origin,
      deleted: true,
      matchReason: 'flag archived'
    };
  }

  protected async restoreStore(data: IStoreDataStorage): Promise<void> {
    const flags = Object.fromEntries(Object.entries(data.flags ?? {}).map(([key, item]) => {
      const compacted = this.compactArchivedFlag(key, item);
      return [key, compacted];
    }));

    // Restoring a cache preserves its cursor; it is not a new full response.
    this.store = { ...data, flags };
    this.initCalled = true;
  }

  protected async addItem(kind: IDataKind, key: string, item: IStoreItem) {
    if (this.applyItem(kind, key, item)) {
      await this.dumpStoreToStorage();
    }
  }

  private applyItem(kind: IDataKind, key: string, item: IStoreItem): boolean {
    let items = this.store[kind.namespace];
    if (!items) {
      items = {};
      this.store[kind.namespace] = items;
    }
    if (Object.hasOwnProperty.call(items, key)) {
      const old = items[key];
      // Accept equal versions: segment changes can update the evaluated value
      // without changing the flag timestamp. Compare against hidden markers too.
      if (old && old.version > item.version) {
        return false;
      }
    }
    items[key] = kind.namespace === DataKinds.Flags.namespace
      ? this.compactArchivedFlag(key, item)
      : item;

    if (item.origin !== StoreItemOriginEnum.Local && item.version > this.store.version) {
      this.store.version = item.version;
    }

    return true;
  }

  async upsertBatch(updates: IStoreUpdate[]): Promise<void> {
    // No awaits between items: readers see the complete patch before persistence.
    let changed = false;
    for (const { kind, data } of updates) {
      changed = this.applyItem(kind, data.key, data) || changed;
    }
    if (changed) {
      await this.dumpStoreToStorage();
    }
  }

  get(kind: IDataKind, key: string): IStoreItem | null {
    const items = this.store[kind.namespace];
    if (items) {
      if (Object.prototype.hasOwnProperty.call(items, key)) {
        const item = items[key];
        if (item && !item.deleted) {
          return item;
        }
      }
    }
    return null;
  }

  all(kind: IDataKind): [IStoreKindData, number] {
    const result: IStoreKindData = {};
    const items: IStoreKindData = this.store[kind.namespace] ?? {};
    Object.entries(items).forEach(([key, item]) => {
      if (item && !item.deleted) {
        result[key] = <IStoreItem>item;
      }
    });

    return [result, this.store.version];
  }

  async init(allData: IStoreDataStorage) {
    const generation = this.contextGeneration;
    let version = 0;
    const flags = Object.fromEntries(Object.entries(allData.flags).map(([key, item]) => {
      if (item.origin !== StoreItemOriginEnum.Local && item.version > version) {
        version = item.version;
      }
      return [key, this.compactArchivedFlag(key, item)];
    }));
    // A full response replaces remote data, including obsolete archive markers,
    // and may move the cursor backwards. Bootstrap timestamps are not remote cursors.
    this.store = { flags, version };

    await this.dumpStoreToStorage();
    if (generation === this.contextGeneration) this.initCalled = true;
  }

  async upsert(kind: IDataKind, data: IKeyedStoreItem) {
    await this.addItem(kind, data.key, data);
  }

  initialized(): boolean {
    return this.initCalled;
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    ++this.contextGeneration;
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

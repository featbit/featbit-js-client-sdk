import {
  StoreStorageKey,
  IStoreDataStorage
} from "./store";
import { BaseStore } from "./BaseStore";
import { hashSerializeUser, deepCopy } from "../utils";

export default class InMemoryStore extends BaseStore {
  private allStores: { [DataStoreStorageKey: string]: IStoreDataStorage } = {};

  constructor() {
    super();
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the LocalStorage store this is a no-op.
  }

  get description(): string {
    return 'in-memory-store'
  }

  protected saveUser(): void {
    // For in-memory store, this is a no-op.
  }

  protected override dumpStoreToStorage() {
    const userHash = hashSerializeUser(this._user);
    const storageKey = `${StoreStorageKey}-${userHash}`;
    this.allStores[storageKey] = deepCopy(this.store);
  }

  protected override loadStoreFromStorage() {
    const userHash = hashSerializeUser(this._user);
    const storageKey = `${StoreStorageKey}-${userHash}`;

    const store = this.allStores[storageKey];

    if (!!store) {
      this.store = store;
    } else {
      this.store.version = 0;
    }
  }
}

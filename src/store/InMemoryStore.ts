import {
  StoreStorageKey,
  IStoreDataStorage
} from "./store";
import { BaseStore } from "./BaseStore";
import { hashSerializeUser } from "../utils";

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

  protected async saveUser(): Promise<void> {
    // For in-memory store, this is a no-op.
  }

  protected override async dumpStoreToStorage() {
    const userHash = await hashSerializeUser(this._user);
    const storageKey = `${StoreStorageKey}-${userHash}`;
    this.allStores[storageKey] = {...this.store};
  }

  protected override async loadStoreFromStorage() {
    const userHash = await hashSerializeUser(this._user);
    const storageKey = `${StoreStorageKey}-${userHash}`;

    this.store = this.allStores[storageKey] ?? { flags: {}, version: 0 };
  }
}
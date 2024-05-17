import {
  StoreStorageKey,
  IStoreDataStorage, CurrentUserStorageKey
} from "../../store/store";
import { IOptions } from "../../options/IOptions";
import { BaseStore } from "../../store/BaseStore";
import { ILogger } from "../../logging";
import { serializeUser } from "../../utils/serializeUser";

export default class LocalStorageStore extends BaseStore {
  private logger: ILogger;

  constructor(options: IOptions) {
    super();

    this.logger = options.logger!;
  }

  /* eslint-disable class-methods-use-this */
  close(): void {
    // For the LocalStorage store this is a no-op.
  }

  get description(): string {
    return 'local-storage-store'
  }

  // This method needs to be overridden in the child class
  protected async saveUser(): Promise<void> {
    localStorage.setItem(CurrentUserStorageKey, serializeUser(this._user));
  }

  protected override async dumpStoreToStorage() {
    const storageKey = `${StoreStorageKey}-${this._user.keyId}`;
    localStorage.setItem(storageKey, JSON.stringify(this.store));
  }

  protected override async loadStoreFromStorage() {
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
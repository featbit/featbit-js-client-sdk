import { StoreStorageKey, CurrentUserStorageKey } from '../../store/store';
import { IOptions } from '../../options/IOptions';
import { BaseStore } from '../../store/BaseStore';
import { hashSerializeUser, serializeUser } from '../../utils/serializeUser';
import { UserCache } from '../../store/UserCache';

export default class LocalStorageStore extends BaseStore {
  private readonly cache: UserCache;
  private storageKey?: string;
  private storageGeneration = -1;

  constructor(options: IOptions) {
    super();
    this.cache = new UserCache({
      keys: () => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key !== null) keys.push(key);
        }
        return keys;
      },
      read: key => localStorage.getItem(key),
      write: (key, value) => localStorage.setItem(key, value),
      remove: key => localStorage.removeItem(key)
    }, options);
  }

  get description(): string {
    return 'local-storage-store';
  }

  protected async saveUser(): Promise<void> {
    try {
      localStorage.setItem(CurrentUserStorageKey, serializeUser(this._user));
    } catch {
      // Optional persistence must not prevent Identify. Cache access below
      // reports storage failures using its rate-limited logger.
    }
  }

  protected override async dumpStoreToStorage() {
    if (this.storageKey && this.storageGeneration === this.contextGeneration) {
      this.cache.save(this.storageKey, this.store);
    }
  }

  protected override async loadStoreFromStorage() {
    const generation = this.contextGeneration;
    const storageKey = `${StoreStorageKey}-${await hashSerializeUser(this._user)}`;
    if (generation !== this.contextGeneration) return;
    this.storageKey = storageKey;
    this.storageGeneration = generation;
    const cached = this.cache.load(this.storageKey);
    this.store = { flags: {}, version: 0 };
    // A cache miss is not an authoritative empty snapshot and must not suppress bootstrap.
    if (!cached) return;
    await this.restoreStore(cached);
    if (generation !== this.contextGeneration) return;
    await this.dumpStoreToStorage();
  }
}

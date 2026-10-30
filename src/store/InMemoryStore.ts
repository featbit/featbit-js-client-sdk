import { StoreStorageKey } from './store';
import { BaseStore } from './BaseStore';
import { hashSerializeUser } from '../utils';
import { UserCache, UserCacheOptions } from './UserCache';

export default class InMemoryStore extends BaseStore {
  private readonly cache: UserCache;
  private storageKey?: string;
  private storageGeneration = -1;

  constructor(options: UserCacheOptions = {}) {
    super();
    const entries = new Map<string, string>();
    this.cache = new UserCache({
      keys: () => [...entries.keys()],
      read: key => entries.get(key) ?? null,
      write: (key, value) => { entries.set(key, value); },
      remove: key => { entries.delete(key); }
    }, options);
  }

  get description(): string {
    return 'in-memory-store';
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

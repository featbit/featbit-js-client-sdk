import { IStoreDataStorage, StoreStorageKey } from './store';
import { ILogger } from '../logging/ILogger';

export const defaultMaxCachedUsers = 5;
export const defaultUserCacheTtl = 7 * 24 * 60 * 60 * 1000;

export interface UserCacheOptions {
  maxCachedUsers?: number;
  userCacheTtl?: number;
  logger?: ILogger;
}

export const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

interface CacheStorage {
  keys(): string[];
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

interface CacheEntry {
  snapshot: IStoreDataStorage;
  lastAccessedAt: number;
  legacy: boolean;
}

/** Shared retention policy for browser storage and in-memory user snapshots. */
export class UserCache {
  private readonly maxUsers: number;
  private readonly ttl: number;
  private lastWarningAt = -Infinity;
  private readonly keyPattern = new RegExp(`^${StoreStorageKey}-[a-f0-9]{64}$`);

  constructor(private readonly storage: CacheStorage, private readonly options: UserCacheOptions = {}) {
    this.maxUsers = isPositiveInteger(options.maxCachedUsers) ? options.maxCachedUsers : defaultMaxCachedUsers;
    this.ttl = isPositiveInteger(options.userCacheTtl) ? options.userCacheTtl : defaultUserCacheTtl;
  }

  private attempt<T>(operation: () => T, fallback: T): T {
    try {
      return operation();
    } catch {
      const now = Date.now();
      if (now - this.lastWarningAt >= 60000) {
        this.lastWarningAt = now;
        this.options.logger?.warn('User cache storage is unavailable; continuing with in-memory flag data.');
      }
      return fallback;
    }
  }

  // null means a readable but corrupt entry; undefined means missing or unreadable.
  private readEntry(key: string, now: number): CacheEntry | null | undefined {
    const raw = this.attempt(() => this.storage.read(key), null);
    if (raw === null) return undefined;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!data || typeof data.flags !== 'object' || data.flags === null || Array.isArray(data.flags) ||
        !Number.isFinite(data.version) || data.version < 0 ||
        !Object.values(data.flags).every((item: any) => item && typeof item === 'object' &&
          Number.isFinite(item.version) && item.version >= 0)) {
      return null;
    }
    const metadata = data._cache;
    if (metadata !== undefined && (metadata?.schemaVersion !== 1 ||
        !Number.isFinite(metadata.lastAccessedAt) || metadata.lastAccessedAt < 0)) {
      return null;
    }
    return {
      snapshot: { flags: data.flags, version: data.version },
      lastAccessedAt: metadata?.lastAccessedAt ?? now,
      legacy: metadata === undefined
    };
  }

  load(key: string): IStoreDataStorage | undefined {
    const now = Date.now();
    const entry = this.readEntry(key, now);
    if (entry === undefined) return undefined;
    if (entry === null) {
      if (this.keyPattern.test(key)) this.attempt(() => this.storage.remove(key), undefined);
      return undefined;
    }
    // Check expiry before touching the timestamp. Active in-memory values are
    // never expired here; this method only runs when selecting a context.
    if (now - entry.lastAccessedAt >= this.ttl) {
      this.attempt(() => this.storage.remove(key), undefined);
      return undefined;
    }
    return entry.snapshot;
  }

  save(key: string, snapshot: IStoreDataStorage): void {
    const now = Date.now();
    this.prune(key, now);
    this.write(key, snapshot, now);
  }

  private write(key: string, snapshot: IStoreDataStorage, lastAccessedAt: number): void {
    this.attempt(() => this.storage.write(key, JSON.stringify({
      flags: snapshot.flags,
      version: snapshot.version,
      _cache: { schemaVersion: 1, lastAccessedAt }
    })), undefined);
  }

  private prune(currentKey: string, now: number): void {
    // Snapshot the key list before removing entries: localStorage indices move.
    const keys = this.attempt(() => this.storage.keys(), []);
    const historical: Array<{ key: string; entry: CacheEntry }> = [];
    for (const key of keys) {
      if (key === currentKey || !this.keyPattern.test(key)) continue;
      const entry = this.readEntry(key, now);
      if (entry === undefined) continue;
      if (entry === null || now - entry.lastAccessedAt >= this.ttl) {
        this.attempt(() => this.storage.remove(key), undefined);
      } else {
        historical.push({ key, entry });
      }
    }
    historical.sort((a, b) => b.entry.lastAccessedAt - a.entry.lastAccessedAt ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    historical.forEach(({ key, entry }, index) => {
      if (index >= this.maxUsers - 1) {
        this.attempt(() => this.storage.remove(key), undefined);
      } else if (entry.legacy) {
        // Establish the TTL once, without treating future scans as accesses.
        this.write(key, entry.snapshot, entry.lastAccessedAt);
      }
    });
  }
}

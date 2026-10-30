import LocalStorageStore from '../../src/platform/browser/LocalStorageStore';
import InMemoryStore from '../../src/store/InMemoryStore';
import DataKinds from '../../src/store/DataKinds';
import { StoreItemOriginEnum } from '../../src/store/store';
import { hashSerializeUser } from '../../src/utils/serializeUser';
import { IUser } from '../../src/options/IUser';
import Configuration from '../../src/Configuration';
import { FbClientBuilder } from '../../src/FbClientBuilder';

const a = { keyId: 'cache-a', name: 'A' };
const b = { keyId: 'cache-b', name: 'B' };
const c = { ...a, customizedProperties: [{ name: 'plan', value: 'paid' }] };
const snapshot = (value: string) => ({
  flags: { flag: { key: 'flag', version: 10, variation: value, origin: StoreItemOriginEnum.Remote } },
  version: 10
});
const cacheKey = async (user: IUser) => `fb-datastore-${await hashSerializeUser(user)}`;

describe('user cache retention', () => {
  let clock: jest.SpyInstance;
  let previous: Map<string, string | null>;
  const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };

  beforeEach(async () => {
    clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    logger.warn.mockClear();
    previous = new Map();
    for (const key of [...await Promise.all([a, b, c].map(cacheKey)), 'fb-user', 'other-app', 'fb-datastore-unrelated']) {
      previous.set(key, localStorage.getItem(key));
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of previous) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  });

  const factories = [
    ['browser', () => new LocalStorageStore({ maxCachedUsers: 2, userCacheTtl: 100, logger })],
    ['memory', () => new InMemoryStore({ maxCachedUsers: 2, userCacheTtl: 100, logger })]
  ] as const;

  it.each(factories)('%s does not restore a cache miss as initialized or suppress bootstrap', async (_, create) => {
    const store = create();
    await store.identify(a);
    await store.identify(b);
    await store.identify(a);
    expect(store.initialized()).toBe(false);
    const client = new FbClientBuilder({ store, offline: true, user: a, logger,
      bootstrap: [{ id: 'flag', variation: 'bootstrap', variationType: 'string' } as any]
    }).build();
    try {
      await client.waitForInitialization();
      expect(client.variation('flag', 'fallback')).toBe('bootstrap');
    } finally {
      await client.close();
    }
  });

  it.each(factories)('%s preserves authoritative empty snapshots over bootstrap', async (_, create) => {
    const store = create();
    await store.identify(a);
    await store.init({ flags: {}, version: 0 });
    await store.identify(b);
    const client = new FbClientBuilder({ store, offline: true, user: a, logger,
      bootstrap: [{ id: 'flag', variation: 'bootstrap', variationType: 'string' } as any]
    }).build();
    try {
      await client.waitForInitialization();
      expect(store.initialized()).toBe(true);
      expect(client.variation('flag', 'fallback')).toBe('fallback');
    } finally {
      await client.close();
    }
  });

  it('does not persist an empty placeholder across browser store instances', async () => {
    const first = new LocalStorageStore({});
    await first.identify(a);
    first.close();
    expect(localStorage.getItem(await cacheKey(a))).toBeNull();
    const second = new LocalStorageStore({});
    await second.identify(a);
    expect(second.initialized()).toBe(false);
  });

  it.each(factories)('%s evicts the least recently used context, including attribute variants', async (_, create) => {
    const store = create();
    await store.identify(a);
    await store.init(snapshot('A'));
    clock.mockReturnValue(1010);
    await store.identify(b);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
    await store.init(snapshot('B'));
    clock.mockReturnValue(1020);
    await store.identify(a);
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('A');
    clock.mockReturnValue(1030);
    await store.identify(c);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
    await store.init(snapshot('C'));
    await store.identify(a);
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('A');
    await store.identify(b);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
  });

  it.each(factories)('%s expires historical snapshots without expiring active memory', async (_, create) => {
    const store = create();
    await store.identify(a);
    await store.init(snapshot('A'));
    clock.mockReturnValue(1200);
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('A');
    await store.identify(b);
    await store.init(snapshot('B'));
    await store.identify(a);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);

    await store.init(snapshot('new-A'));
    clock.mockReturnValue(1300);
    await store.identify(a);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
  });

  it('adopts legacy timestamps once, enforces the count and preserves unrelated keys', async () => {
    const keys = await Promise.all([a, b, c].map(cacheKey));
    keys.forEach((key, index) => localStorage.setItem(key, JSON.stringify(snapshot(String(index)))));
    localStorage.setItem('other-app', 'keep');
    localStorage.setItem('fb-datastore-unrelated', 'keep');
    const store = new LocalStorageStore({ maxCachedUsers: 2, userCacheTtl: 100, logger });
    await store.identify(a);
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('0');
    const retained = keys.filter(key => localStorage.getItem(key) !== null);
    expect(retained).toHaveLength(2);
    const historical = retained.find(key => key !== keys[0])!;
    expect(JSON.parse(localStorage.getItem(historical)!)._cache.lastAccessedAt).toBe(1000);
    clock.mockReturnValue(1050);
    await store.init(snapshot('updated'));
    expect(JSON.parse(localStorage.getItem(historical)!)._cache.lastAccessedAt).toBe(1000);
    clock.mockReturnValue(1100);
    await store.init(snapshot('updated-again'));
    expect(localStorage.getItem(historical)).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
    expect(localStorage.getItem('fb-datastore-unrelated')).toBe('keep');

    localStorage.setItem(keys[1], '{corrupt');
    await store.identify(b);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
  });

  it('removes corrupt historical caches but preserves unreadable and unrelated entries', async () => {
    const keyB = await cacheKey(b);
    const keyC = await cacheKey(c);
    localStorage.setItem(keyB, '{corrupt');
    localStorage.setItem(keyC, JSON.stringify({ flags: {}, version: -1 }));
    localStorage.setItem('fb-datastore-unrelated', '{corrupt');
    const store = new LocalStorageStore({ maxCachedUsers: 2, logger });
    await store.identify(a);
    await store.init(snapshot('A'));
    expect(localStorage.getItem(keyB)).toBeNull();
    expect(localStorage.getItem(keyC)).toBeNull();
    expect(localStorage.getItem('fb-datastore-unrelated')).toBe('{corrupt');
    expect(logger.warn).not.toHaveBeenCalled();

    const saved = JSON.stringify(snapshot('B'));
    localStorage.setItem(keyB, saved);
    const getItem = Storage.prototype.getItem;
    const reads = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === keyB) throw new Error('Blocked');
      return getItem.call(this, key);
    });
    await store.init(snapshot('A'));
    reads.mockRestore();
    expect(localStorage.getItem(keyB)).toBe(saved);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('continues in memory through storage failures and rate-limits warnings', async () => {
    const store = new LocalStorageStore({ maxCachedUsers: 1, userCacheTtl: 100, logger });
    const writes = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    await store.identify(a);
    await store.init(snapshot('A'));
    await store.init(snapshot('A2'));
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('A2');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    writes.mockRestore();

    const reads = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    await store.identify(b);
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
    reads.mockRestore();
    const enumeration = jest.spyOn(Storage.prototype, 'key').mockImplementation(() => { throw new Error('Blocked'); });
    await store.init(snapshot('B'));
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('B');
    enumeration.mockRestore();
    const removal = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Blocked'); });
    await store.identify(c);
    await store.init(snapshot('C'));
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('C');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    removal.mockRestore();
  });

  it('exposes builder options and defaults invalid configuration to finite retention limits', async () => {
    const config = new Configuration({ offline: true, maxCachedUsers: Infinity, userCacheTtl: -1 });
    expect(config.maxCachedUsers).toBe(5);
    expect(config.userCacheTtl).toBe(7 * 24 * 60 * 60 * 1000);
    const client = new FbClientBuilder({ bootstrap: [{ id: 'flag', variation: 'local', variationType: 'string' } as any] }).offline(true).user(a).logger(logger)
      .maxCachedUsers(1).userCacheTtl(100).build();
    try {
      await client.waitForInitialization();
      await client.identify(b);
      expect(localStorage.getItem(await cacheKey(a))).toBeNull();
      expect(JSON.parse(localStorage.getItem(await cacheKey(b))!)._cache.schemaVersion).toBe(1);
    } finally {
      await client.close();
    }
  });
});

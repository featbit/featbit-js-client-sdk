import { BaseStore } from "../../src/store/BaseStore";
import DataKinds from "../../src/store/DataKinds";
import { IKeyedStoreItem, IStoreDataStorage, StoreItemOriginEnum } from "../../src/store/store";
import { deserializeAll, deserializePatch } from "../../src/store/serialization";
import { IFlag, VariationDataType } from "../../src/evaluation/data/IFlag";
import Evaluator from "../../src/evaluation/Evaluator";
import { ReasonKinds } from "../../src/evaluation/ReasonKinds";
import LocalStorageStore from "../../src/platform/browser/LocalStorageStore";
import { hashSerializeUser } from "../../src/utils/serializeUser";

class RecordingStore extends BaseStore {
  persisted: IStoreDataStorage = { flags: {}, version: 0 };

  protected async dumpStoreToStorage() {
    this.persisted = JSON.parse(JSON.stringify(this.store));
  }
}

function flag(version: number, archived = false): IFlag {
  return {
    id: 'checkout', key: 'checkout', version, timestamp: version,
    origin: StoreItemOriginEnum.Remote,
    variation: archived ? null : 'true', variationType: VariationDataType.boolean,
    matchReason: archived ? 'flag archived' : 'default',
    variationOptions: [{ id: 1, value: 'true' }],
    variations: [{ id: 1, value: 'true' }],
    sendToExperiment: true
  };
}

const marker = (version: number) => ({
  key: 'checkout', version, origin: StoreItemOriginEnum.Remote,
  deleted: true, matchReason: 'flag archived'
});

describe('archived flag storage', () => {
  it('compacts a remote patch, hides it from reads, and retains its cursor', async () => {
    const store = new RecordingStore();
    await store.init({ flags: { checkout: flag(10) }, version: 0 });
    const [patch] = deserializePatch([flag(20, true)]);
    await store.upsert(patch.kind, patch.data);

    expect(store.persisted).toEqual({ flags: { checkout: marker(20) }, version: 20 });
    expect(store.get(DataKinds.Flags, 'checkout')).toBeNull();
    expect(store.all(DataKinds.Flags)).toEqual([{}, 20]);
    expect(new Evaluator(store).evaluate('checkout').kind).toBe(ReasonKinds.FlagNotFound);
  });

  it('rejects older patches while allowing equal-version updates and later restoration', async () => {
    const store = new RecordingStore();
    await store.upsert(DataKinds.Flags, flag(20, true));
    await store.upsert(DataKinds.Flags, flag(19));
    expect(store.persisted.flags.checkout).toEqual(marker(20));

    await store.upsert(DataKinds.Flags, flag(20));
    expect(store.get(DataKinds.Flags, 'checkout')?.variation).toBe('true');
    await store.upsert(DataKinds.Flags, { ...flag(20), variation: 'false' });
    expect(store.get(DataKinds.Flags, 'checkout')?.variation).toBe('false');

    await store.upsert(DataKinds.Flags, flag(19, true));
    expect(store.get(DataKinds.Flags, 'checkout')?.variation).toBe('false');
    await store.upsert(DataKinds.Flags, flag(21, true));
    expect(store.get(DataKinds.Flags, 'checkout')).toBeNull();
    await store.upsert(DataKinds.Flags, flag(22));
    expect(store.get(DataKinds.Flags, 'checkout')?.variation).toBe('true');
    expect(store.version).toBe(22);
  });

  it('replaces full snapshots and recalculates the cursor including archived flags', async () => {
    const store = new RecordingStore();
    await store.upsert(DataKinds.Flags, { ...flag(100), key: 'obsolete' });
    const input = flag(20, true);
    const full = deserializeAll([input]);
    await store.init({ ...full, version: 0 });
    expect(store.persisted).toEqual({ flags: { checkout: marker(20) }, version: 20 });
    expect(input.variationOptions).toHaveLength(1);

    // A later full snapshot can restore a flag even with a lower version.
    await store.init({ flags: { checkout: flag(10) }, version: 0 });
    expect(store.get(DataKinds.Flags, 'checkout')?.version).toBe(10);
    await store.upsert(DataKinds.Flags, flag(30, true));
    await store.init({ flags: {}, version: 0 });
    expect(store.persisted).toEqual({ flags: {}, version: 0 });
  });

  it('does not advance the remote cursor with local bootstrap timestamps', async () => {
    const store = new RecordingStore();
    const local: IKeyedStoreItem = {
      ...flag(1000), key: 'local-only', origin: StoreItemOriginEnum.Local
    };
    await store.init({ flags: { checkout: flag(20, true), 'local-only': local }, version: 0 });
    expect(store.all(DataKinds.Flags)).toEqual([{ 'local-only': local }, 20]);
    await store.upsert(DataKinds.Flags, { ...local, version: 2000 });
    expect(store.version).toBe(20);
  });

  it('compacts a legacy browser cache on load and persists version protection', async () => {
    const user = { keyId: 'archive-cache-test' };
    const key = `fb-datastore-${await hashSerializeUser(user)}`;
    const previousUser = localStorage.getItem('fb-user');
    const previousCache = localStorage.getItem(key);
    try {
      localStorage.setItem(key, JSON.stringify({ flags: { checkout: flag(20, true) }, version: 50 }));
      const store = new LocalStorageStore({});
      await store.identify(user);
      expect(store.all(DataKinds.Flags)).toEqual([{}, 50]);
      expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
        flags: { checkout: marker(20) }, version: 50,
        _cache: { schemaVersion: 1, lastAccessedAt: expect.any(Number) }
      });

      const reloaded = new LocalStorageStore({});
      await reloaded.identify(user);
      await reloaded.upsert(DataKinds.Flags, flag(19));
      expect(reloaded.get(DataKinds.Flags, 'checkout')).toBeNull();
      expect(reloaded.version).toBe(50);
    } finally {
      if (previousCache === null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousCache);
      if (previousUser === null) localStorage.removeItem('fb-user');
      else localStorage.setItem('fb-user', previousUser);
    }
  });
});

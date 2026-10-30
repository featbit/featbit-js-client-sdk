import LocalStorageStore from '../../src/platform/browser/LocalStorageStore';
import InMemoryStore from '../../src/store/InMemoryStore';
import DataSourceUpdates from '../../src/data-sources/DataSourceUpdates';
import DataKinds from '../../src/store/DataKinds';
import { StoreItemOriginEnum } from '../../src/store/store';
import * as serialization from '../../src/utils/serializeUser';

const user = (plan: string) => ({ keyId: 'isolation-cache', name: 'User', customizedProperties: [{ name: 'plan', value: plan }] });
const flag = (value: string) => ({ key: 'flag', version: 1, variation: value, origin: StoreItemOriginEnum.Remote });
const snapshot = (value: string) => ({ flags: { flag: flag(value) }, version: 1 });

describe('cache and commit isolation', () => {
  const saved = new Map<string, string | null>();
  beforeEach(async () => {
    saved.clear();
    for (const context of [user('A'), user('B')]) {
      const key = `fb-datastore-${await serialization.hashSerializeUser(context)}`;
      saved.set(key, localStorage.getItem(key));
    }
    saved.set('fb-user', localStorage.getItem('fb-user'));
  });
  afterEach(() => {
    jest.restoreAllMocks();
    for (const [key, value] of saved) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  });

  it.each([
    ['browser', () => new LocalStorageStore({})],
    ['memory', () => new InMemoryStore()]
  ] as const)('%s discards a delayed cache load after a newer Identify', async (_, create) => {
    const store = create();
    await store.identify(user('A'));
    await store.init(snapshot('cached-A'));
    const keyA = await serialization.hashSerializeUser(user('A'));
    let release!: (hash: string) => void;
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const delayed = new Promise<string>(resolve => { release = resolve; });
    jest.spyOn(serialization, 'hashSerializeUser').mockImplementationOnce(() => { entered(); return delayed; });
    const oldLoad = store.identify(user('A'));
    await started;
    const contextB = user('B');
    await store.identify(contextB);
    contextB.customizedProperties[0].value = 'mutated';
    await store.init(snapshot('current-B'));
    release(keyA);
    await oldLoad;
    expect(store.user.customizedProperties?.[0].value).toBe('B');
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('current-B');
    await store.identify(user('A'));
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('cached-A');
  });

  it('drains delayed writes before switching context and suppresses old completion callbacks', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    class DelayedStore extends LocalStorageStore {
      delay = false;
      protected async dumpStoreToStorage() {
        if (this.delay) { entered(); await gate; }
        await super.dumpStoreToStorage();
      }
    }
    const store = new DelayedStore({});
    await store.identify(user('A'));
    const changed = jest.fn();
    const completed = jest.fn();
    const updates = new DataSourceUpdates(store, () => true, changed);
    store.delay = true;
    const oldCommit = updates.init('isolation-cache', snapshot('A'), completed);
    await started;
    const queued = updates.init('isolation-cache', snapshot('obsolete-A'), completed);
    const switching = updates.identify(user('B'));
    store.delay = false;
    release();
    await Promise.all([oldCommit, queued, switching]);
    expect(changed).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
    await updates.init('isolation-cache', snapshot('B'));
    for (const plan of ['A', 'B']) {
      const key = `fb-datastore-${await serialization.hashSerializeUser(user(plan))}`;
      expect(JSON.parse(localStorage.getItem(key)!).flags.flag.variation).toBe(plan);
    }
  });
});

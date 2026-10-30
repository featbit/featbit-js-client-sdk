import DataSourceUpdates from '../../src/data-sources/DataSourceUpdates';
import { createStreamListeners } from '../../src/data-sources/createStreamListeners';
import { BaseStore } from '../../src/store/BaseStore';
import DataKinds from '../../src/store/DataKinds';
import { IKeyedStoreItem, IStoreDataStorage, StoreItemOriginEnum } from '../../src/store/store';

class RecordingStore extends BaseStore {
  writes: IStoreDataStorage[] = [];
  beforePersist?: () => Promise<void>;

  protected async dumpStoreToStorage() {
    this.writes.push(JSON.parse(JSON.stringify(this.store)));
    await this.beforePersist?.();
  }
}

const flag = (key: string, version: number, variation = 'false'): IKeyedStoreItem => ({
  key, version, variation, variationType: 'boolean', origin: StoreItemOriginEnum.Remote
});
const patch = (...items: IKeyedStoreItem[]) => items.map(data => ({ kind: DataKinds.Flags, data }));
const full = (...items: IKeyedStoreItem[]): IStoreDataStorage => ({
  flags: Object.fromEntries(items.map(item => [item.key, item])), version: 0
});

async function setup() {
  const store = new RecordingStore();
  await store.identify({ keyId: 'user' });
  const changed = jest.fn();
  const updates = new DataSourceUpdates(store, () => true, changed);
  return { store, changed, updates };
}

describe('response commits and update events', () => {
  it('persists and notifies once per patch, with every changed value visible to listeners', async () => {
    const { store, changed, updates } = await setup();
    await updates.init('user', full(flag('a', 1), flag('b', 1)));
    changed.mockClear();
    store.writes = [];
    const completed = jest.fn();
    const listeners = createStreamListeners(updates, undefined, { patch: completed });
    const observed: unknown[] = [];
    changed.mockImplementation(keys => observed.push([keys, store.all(DataKinds.Flags)[0]]));

    await listeners.get('patch')!.processJson('user', patch(
      flag('a', 2, 'true'), flag('a', 2, 'true'), flag('b', 2, 'true')
    ));
    expect(store.writes).toHaveLength(1);
    expect(observed).toEqual([[['a', 'b'], { a: flag('a', 2, 'true'), b: flag('b', 2, 'true') }]]);
    expect(completed).toHaveBeenCalledTimes(1);

    await listeners.get('patch')!.processJson('user', []);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(2);
    expect(store.writes).toHaveLength(1);
  });

  it('notifies on archive and restoration, but not repeated archives or rejected patches', async () => {
    const { store, changed, updates } = await setup();
    await updates.init('user', full(flag('a', 1)));
    changed.mockClear();
    const archived = { ...flag('a', 2), matchReason: 'flag archived', variation: null };

    await updates.upsertBatch('user', patch(archived));
    expect(store.get(DataKinds.Flags, 'a')).toBeNull();
    expect(changed.mock.calls).toEqual([[['a']]]);
    await updates.upsertBatch('user', patch(archived, flag('a', 1, 'true')));
    expect(changed).toHaveBeenCalledTimes(1);

    await updates.upsertBatch('user', patch(flag('a', 2, 'true')));
    await updates.upsertBatch('user', patch(flag('a', 2, 'true')));
    expect(changed.mock.calls).toEqual([[['a']], [['a']]]);
    await updates.upsertBatch('user', patch(flag('a', 2, 'false')));
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('reports full replacement changes regardless of versions without resurrecting bootstrap values', async () => {
    const { store, changed, updates } = await setup();
    const local = { ...flag('local', 100), origin: StoreItemOriginEnum.Local };
    const replaced = { ...flag('replaced', 100), origin: StoreItemOriginEnum.Local };
    await updates.init('user', full(local, replaced));
    await updates.init('user', full(flag('a', 20), flag('removed', 20), {
      ...flag('replaced', 20), matchReason: 'flag archived'
    }));
    changed.mockClear();

    await updates.init('user', full(flag('a', 10, 'true')));
    expect(changed.mock.calls).toEqual([[['a', 'removed']]]);
    expect(store.all(DataKinds.Flags)[0]).toEqual({ local, a: flag('a', 10, 'true') });
    await updates.init('user', full());
    expect(changed.mock.calls).toEqual([[['a', 'removed']], [['a']]]);
    expect(store.all(DataKinds.Flags)).toEqual([{ local }, 0]);
    await updates.init('user', full());
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('serializes overlapping patch/full responses while a batch is waiting for persistence', async () => {
    const { store, changed, updates } = await setup();
    await updates.init('user', full(flag('a', 1), flag('b', 1)));
    changed.mockClear();
    store.writes = [];
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    store.beforePersist = () => { entered(); return gate; };

    const first = updates.upsertBatch('user', patch(flag('a', 3, 'true'), flag('b', 3, 'true')));
    await started;
    const second = updates.init('user', full(flag('a', 2)));
    const third = updates.upsertBatch('user', patch(flag('a', 4, 'true')));
    expect(store.all(DataKinds.Flags)[0]).toEqual({ a: flag('a', 3, 'true'), b: flag('b', 3, 'true') });
    expect(changed).not.toHaveBeenCalled();
    expect(store.writes).toHaveLength(1);

    store.beforePersist = undefined;
    release();
    await Promise.all([first, second, third]);
    expect(changed.mock.calls).toEqual([[['a', 'b']], [['a', 'b']], [['a']]]);
    expect(store.writes.map(snapshot => snapshot.version)).toEqual([3, 2, 4]);
    expect(store.all(DataKinds.Flags)[0]).toEqual({ a: flag('a', 4, 'true') });
  });

  it('continues processing batches after a failed response', async () => {
    const { store, changed, updates } = await setup();
    const failure = new Error('store failed');
    jest.spyOn(store, 'upsertBatch').mockRejectedValueOnce(failure);
    const failed = updates.upsertBatch('user', patch(flag('a', 1)));
    const next = updates.init('user', full(flag('b', 2)));
    await expect(failed).rejects.toBe(failure);
    await next;
    expect(changed.mock.calls).toEqual([[['b']]]);

    changed.mockClear();
    const completed = jest.fn();
    await updates.upsertBatch('user', patch(flag('a', 3), flag('b', 3, 'true')), completed);
    expect(changed.mock.calls).toEqual([[['b', 'a']]]);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(store.all(DataKinds.Flags)[0]).toEqual({ a: flag('a', 3), b: flag('b', 3, 'true') });
  });
});

import FullSyncPolicy from '../../src/data-sync/FullSyncPolicy';
import PollingDataSynchronizer from '../../src/data-sync/PollingDataSynchronizer';
import Configuration from '../../src/Configuration';
import Requestor from '../../src/data-sync/Requestor';
import { BaseStore } from '../../src/store/BaseStore';
import DataSourceUpdates from '../../src/data-sources/DataSourceUpdates';
import { createStreamListeners } from '../../src/data-sources/createStreamListeners';
import DataKinds from '../../src/store/DataKinds';

const user = (plan: string) => ({ keyId: 'same-key', name: 'User', customizedProperties: [{ name: 'plan', value: plan }] });
const response = (value: string) => JSON.stringify({ messageType: 'data-sync', data: {
  eventType: 'full', userKeyId: 'same-key', featureFlags: [{ id: 'flag', timestamp: 1, variation: value }]
} });

describe('polling context isolation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ignores old responses and errors for same-key A-B-A contexts and settles superseded Identify', async () => {
    const requests: Array<{ context: any; callback: (error: any, body: any) => any }> = [];
    const requestor = { requestData: jest.fn((_ts, context, callback) => requests.push({ context, callback })) };
    const store = new BaseStore();
    await store.identify(user('A'));
    const changed = jest.fn();
    const ready = jest.fn();
    const failed = jest.fn();
    const updates = new DataSourceUpdates(store, () => true, changed);
    const sync = new PollingDataSynchronizer(new Configuration({ user: user('A'), offline: true }),
      requestor as unknown as Requestor, () => store.version,
      createStreamListeners(updates, undefined, { put: ready, patch: ready }), new FullSyncPolicy(), failed);
    sync.start();
    const contextB = user('B');
    await updates.identify(contextB);
    const second = sync.identify(contextB).catch(error => error);
    contextB.customizedProperties[0].value = 'mutated';
    expect(requests[1].context.customizedProperties[0].value).toBe('B');
    await updates.identify(user('A'));
    const third = sync.identify(user('A'));
    await requests[0].callback(undefined, response('old-A'));
    await requests[1].callback({ status: 401 }, undefined);
    expect(await second).toBeInstanceOf(Error);
    expect(store.get(DataKinds.Flags, 'flag')).toBeNull();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    await requests[2].callback(undefined, response('new-A'));
    await third;
    expect(store.get(DataKinds.Flags, 'flag')?.variation).toBe('new-A');
    expect(ready).toHaveBeenCalledTimes(1);
    sync.close();
    await jest.advanceTimersByTimeAsync(60000);
    expect(requests).toHaveLength(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not resolve a new Identify or schedule an old poll after an asynchronous commit returns', async () => {
    const callbacks: Array<(error: any, body: any) => any> = [];
    const requestor = { requestData: jest.fn((_ts, _user, callback) => callbacks.push(callback)) };
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let accepted = 0;
    const handler = { deserializeData: (flags: any) => flags,
      processJson: async (_key: string, _data: any, isCurrent = () => true) => {
        await gate;
        if (isCurrent()) accepted++;
      } };
    const sync = new PollingDataSynchronizer(new Configuration({ user: user('A'), offline: true }),
      requestor as unknown as Requestor, () => 0, new Map([['put', handler]]), new FullSyncPolicy());
    sync.start();
    const oldProcessing = callbacks[0](undefined, response('old'));
    let resolved = false;
    const identifying = sync.identify(user('B')).then(() => { resolved = true; });
    release();
    await oldProcessing;
    expect(accepted).toBe(0);
    expect(resolved).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    await callbacks[1](undefined, response('new'));
    await identifying;
    expect(accepted).toBe(1);
    sync.close();
  });
});

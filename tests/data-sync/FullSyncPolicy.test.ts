import Configuration from '../../src/Configuration';
import FullSyncPolicy, { defaultFullSyncInterval } from '../../src/data-sync/FullSyncPolicy';
import PollingDataSynchronizer from '../../src/data-sync/PollingDataSynchronizer';
import Requestor from '../../src/data-sync/Requestor';
import { BaseStore } from '../../src/store/BaseStore';
import DataSourceUpdates from '../../src/data-sources/DataSourceUpdates';
import { createStreamListeners } from '../../src/data-sources/createStreamListeners';
import DataKinds from '../../src/store/DataKinds';

const user = { keyId: 'user', name: 'User' };
const response = (eventType: string, featureFlags: any[] = []) => JSON.stringify({
  messageType: 'data-sync', data: { userKeyId: user.keyId, eventType, featureFlags }
});

describe('full refresh policy', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Math, 'random').mockReturnValue(0.5); });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  it('validates the interval and applies jitter only after a successful full commit', () => {
    expect(new Configuration({ offline: true }).fullSyncInterval).toBe(defaultFullSyncInterval);
    expect(new Configuration({ offline: true, fullSyncInterval: -1 }).fullSyncInterval).toBe(defaultFullSyncInterval);
    const policy = new FullSyncPolicy(100000);
    expect(policy.timestamp(42)).toBe(0);
    jest.mocked(Math.random).mockReturnValue(0);
    policy.committed();
    expect(policy.delay).toBe(90000);
    expect(policy.timestamp(42)).toBe(42);
    jest.advanceTimersByTime(90000);
    expect(policy.timestamp(42)).toBe(0);
    jest.mocked(Math.random).mockReturnValue(1);
    policy.committed();
    expect(policy.delay).toBeCloseTo(110000);
    policy.reset();
    expect(policy.timestamp(42)).toBe(0);
  });

  it('retains data on failure, retries full after patch/304, and clears data on an empty full', async () => {
    const policy = new FullSyncPolicy(60000);
    const store = new BaseStore();
    await store.identify(user);
    const updates = new DataSourceUpdates(store, () => true, jest.fn());
    const listeners = createStreamListeners(updates, undefined, { put: () => policy.committed() });
    // Seed a cached cursor without acknowledging an online full response.
    await createStreamListeners(updates).get('put')!.processJson(user.keyId,
      listeners.get('put')!.deserializeData([{ id: 'flag', timestamp: 42, variation: 'true' } as any]));
    const requests: Array<{ timestamp: number; callback: (error: any, body: any) => Promise<void> }> = [];
    const requestor = { requestData: (timestamp: number, _user: any, callback: any) => requests.push({ timestamp, callback }) };
    const sync = new PollingDataSynchronizer(new Configuration({ user, offline: true, pollingInterval: 1000 }),
      requestor as unknown as Requestor, () => store.version, listeners, policy);
    sync.start();
    expect(requests[0].timestamp).toBe(0);
    await requests[0].callback({ status: 503 }, undefined);
    expect(store.get(DataKinds.Flags, 'flag')).not.toBeNull();
    await jest.advanceTimersByTimeAsync(1000);
    await requests[1].callback(undefined, response('patch'));
    await jest.advanceTimersByTimeAsync(1000);
    await requests[2].callback(undefined, null);
    await jest.advanceTimersByTimeAsync(1000);
    expect(requests.map(r => r.timestamp)).toEqual([0, 0, 0, 0]);
    await requests[3].callback(undefined, response('full', [{ id: 'flag', timestamp: 50, variation: 'true' }]));
    await jest.advanceTimersByTimeAsync(1000);
    expect(requests[4].timestamp).toBe(50);
    // A pending request is not duplicated when a page resumes after a long sleep.
    jest.setSystemTime(Date.now() + 60000);
    window.dispatchEvent(new Event('pageshow'));
    expect(requests).toHaveLength(5);
    await requests[4].callback(undefined, response('patch'));
    await jest.advanceTimersByTimeAsync(0);
    expect(requests[5].timestamp).toBe(0);
    await requests[5].callback(undefined, response('full'));
    expect(store.all(DataKinds.Flags)).toEqual([{}, 0]);
    expect(policy.due).toBe(false);
    sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });
});

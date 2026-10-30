import { FbClientBuilder } from '../../src/FbClientBuilder';
import { IFbClient } from '../../src/IFbClient';
import TestData from '../../src/integrations/test_data/TestData';
import InMemoryStore from '../../src/store/InMemoryStore';
import { IFlag, VariationDataType } from '../../src/evaluation/data/IFlag';
import { IDataSynchronizer } from '../../src/data-sync/IDataSynchronizer';
import { FlagBuilder } from '../../src/integrations/test_data/FlagBuilder';
import { StoreItemOriginEnum } from '../../src/store/store';
import DataKinds from '../../src/store/DataKinds';

const user = (keyId: string) => ({ keyId, name: keyId });
const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
const flag = (value: string) => ({ id: 'flag', variation: value, variationType: VariationDataType.string } as IFlag);
const flush = () => jest.advanceTimersByTimeAsync(0);

describe('custom synchronizer Identify lifecycle', () => {
  let client: IFbClient;
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await client?.close();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['startup', 'Identify'])('reports the actual async store error during %s', async phase => {
    const data = new TestData();
    const store = new InMemoryStore();
    const failure = new Error('store init failed');
    const failInit = () => jest.spyOn(store, 'init').mockRejectedValue(failure);
    if (phase === 'startup') failInit();
    client = new FbClientBuilder({ sdkKey: 'key', user: user('A'), store,
      dataSynchronizer: data.getFactory(), disableEvents: true, startWaitTime: 100, logger }).build();
    const error = jest.fn();
    const failed = jest.fn();
    client.on('error', error);
    client.on('failed', failed);
    let identifying: Promise<void> | undefined;
    if (phase === 'Identify') {
      await client.waitForInitialization();
      failInit();
      identifying = client.identify(user('B'));
    }
    await expect(client.waitForInitialization()).rejects.toBe(failure);
    await identifying;
    expect(client.initialized()).toBe(false);
    expect(error).toHaveBeenCalledWith(failure);
    expect(failed).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(200);
    await expect(client.waitForInitialization()).rejects.toBe(failure);
  });

  it('ignores a stopped TestData startup failure while completing the new context', async () => {
    let rejectStart!: (error: Error) => void;
    const store = new InMemoryStore();
    jest.spyOn(store, 'init').mockImplementationOnce(() =>
      new Promise<void>((_resolve, reject) => { rejectStart = reject; }));
    const data = new TestData();
    client = new FbClientBuilder({ sdkKey: 'key', user: user('A'), store,
      disableEvents: true, logger, dataSynchronizer: data.getFactory() }).build();
    const failed = jest.fn();
    client.on('failed', failed);
    await flush();
    const identifying = client.identify(user('B'));
    rejectStart(new Error('old startup failed'));
    await identifying;
    await client.waitForInitialization();
    await flush();
    expect(client.initialized()).toBe(true);
    expect(failed).not.toHaveBeenCalled();
  });

  it('preserves FlagBuilder choices and remote evaluations across Identify', async () => {
    const data = new TestData();
    const store = new InMemoryStore();
    client = new FbClientBuilder({ sdkKey: 'key', user: user('A'), store,
      dataSynchronizer: data.getFactory(), disableEvents: true, logger }).build();
    await client.waitForInitialization();
    const choices = [{ id: 1, value: 'yes' }, { id: 2, value: 'no' }];
    await data.update(new FlagBuilder().id('flag').key('flag').origin(StoreItemOriginEnum.Remote)
      .variationType(VariationDataType.string).variation('yes').variations(choices).build());
    expect(client.stringVariation('flag', 'fallback')).toBe('yes');
    for (const key of ['A', 'B', 'A']) {
      await client.identify(user(key));
      await client.waitForInitialization();
      expect(store.get(DataKinds.Flags, 'flag')?.variations).toEqual(choices);
      expect(client.stringVariation('flag', 'fallback')).toBe('yes');
    }
  });

  it.each(['test-user-key-id', 'application-user'])('restores TestData readiness and flags for %s and a different user', async key => {
    const data = new TestData();
    client = new FbClientBuilder({ sdkKey: 'key', user: user(key), store: new InMemoryStore(),
      dataSynchronizer: data.getFactory(), disableEvents: true, logger }).build();
    await client.waitForInitialization();
    await data.update(flag('first'));
    const ready = jest.fn();
    client.on('ready', ready);

    for (const keyId of [key, 'other-user', key]) {
      const identifying = client.identify(user(keyId));
      const waiting = client.waitForInitialization();
      await identifying;
      await waiting;
      expect(client.initialized()).toBe(true);
      expect(client.variation('flag', 'fallback')).toBe('first');
    }
    expect(ready).toHaveBeenCalledTimes(3);
    await data.update(flag('second'));
    expect(client.variation('flag', 'fallback')).toBe('second');
    await client.identify(user('other-user'));
    await client.waitForInitialization();
    expect(client.variation('flag', 'fallback')).toBe('second');
  });

  it('restarts a custom source but waits for its committed response before marking ready', async () => {
    let commit!: () => Promise<void>;
    let source!: IDataSynchronizer;
    let active = false;
    const start = jest.fn(() => { active = true; });
    client = new FbClientBuilder({ sdkKey: 'key', user: user('A'), store: new InMemoryStore(),
      disableEvents: true, logger,
      dataSynchronizer: (_context, store, updates, ready) => {
        source = { start, stop: () => { active = false; }, close: () => { active = false; },
          identify: jest.fn(async () => {}) };
        commit = () => updates.init(store.user.keyId, { flags: {}, version: 0 }, ready, () => active);
        return source;
      }
    }).build();
    await flush();
    await commit();
    await client.waitForInitialization();
    const identifying = client.identify(user('B'));
    let ready = false;
    const waiting = client.waitForInitialization().then(() => { ready = true; });
    await identifying;
    expect(source.identify).toHaveBeenCalledWith(user('B'));
    expect(start).toHaveBeenCalledTimes(2);
    expect(active).toBe(true);
    expect(ready).toBe(false);
    expect(client.initialized()).toBe(false);
    await commit();
    await waiting;
    expect(ready).toBe(true);
  });

  it.each(['supersede', 'close'])('does not restart a stale custom Identify after %s', async action => {
    let release!: () => void;
    const start = jest.fn();
    client = new FbClientBuilder({ sdkKey: 'key', user: user('A'), store: new InMemoryStore(),
      disableEvents: true, logger,
      dataSynchronizer: (_context, _store, _updates, ready) => ({
        start: () => { start(); ready(); }, stop() {}, close() {},
        identify: async context => {
          if (context.keyId === 'B') await new Promise<void>(resolve => { release = resolve; });
        }
      })
    }).build();
    await client.waitForInitialization();
    const stale = client.identify(user('B'));
    await flush();
    if (action === 'close') await client.close();
    else await client.identify(user('C'));
    const calls = start.mock.calls.length;
    release();
    await stale;
    expect(start).toHaveBeenCalledTimes(calls);
  });
});

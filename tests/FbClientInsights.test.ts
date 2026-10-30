import { FbClientCore } from '../src/FbClientCore';
import { DefaultEventProcessor } from '../src/events/DefaultEventProcessor';
import { EvalEvent, MetricEvent } from '../src/events/event';
import { BrowserPlatform } from '../src/platform/browser/BrowserPlatform';
import { IOptions } from '../src/options/IOptions';
import { IFlag, VariationDataType } from '../src/evaluation/data/IFlag';
import InMemoryStore from '../src/store/InMemoryStore';
import { StoreItemOriginEnum } from '../src/store';
import { deserializeAll, deserializePatch } from '../src/store/serialization';

jest.mock('../src/events/DefaultEventProcessor');

describe('evaluation insights', () => {
  let client: FbClientCore;
  let store: InMemoryStore;
  let record: jest.Mock;

  function flag(insightsEnabled?: boolean): IFlag {
    return {
      id: 'flag', key: 'flag', variation: 'true',
      variationType: VariationDataType.boolean,
      variationOptions: [{ id: 0, value: 'true' }],
      variations: [{ id: 0, value: 'true' }],
      timestamp: 1, version: 1, origin: StoreItemOriginEnum.Remote,
      matchReason: 'target match', sendToExperiment: true,
      ...(insightsEnabled === undefined ? {} : { insightsEnabled }),
    };
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    store = new InMemoryStore();
    const options: IOptions = {
      sdkKey: 'sdk-key', user: { keyId: 'user', name: 'user', customizedProperties: [] }, store,
      dataSynchronizer: (_context, _store, _updates, ready) => ({
        start: ready, stop: jest.fn(), close: jest.fn(), identify: jest.fn(),
      }),
    };
    client = new FbClientCore(options, new BrowserPlatform(options), {
      onError: jest.fn(), onFailed: jest.fn(), onReady: jest.fn(),
      onUpdate: jest.fn(), hasEventListeners: () => false,
    });
    await client.waitForInitialization();
    record = (DefaultEventProcessor as jest.MockedClass<typeof DefaultEventProcessor>)
      .mock.instances[0].record as jest.Mock;
  });

  afterEach(async () => {
    await client.close();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each([true, false, undefined])('handles insightsEnabled=%s in full data', async (enabled) => {
    await store.init({ ...deserializeAll([flag(enabled)]), version: 1 });
    expect(client.boolVariation('flag', false)).toBe(true);
    expect(client.variationDetail('flag', false).value).toBe(true);
    expect(record).toHaveBeenCalledTimes(enabled === false ? 0 : 2);
    if (enabled !== false) {
      expect(record).toHaveBeenCalledWith(expect.any(EvalEvent));
    }
  });

  it('applies changes to insightsEnabled from incremental data', async () => {
    await store.init({ ...deserializeAll([flag(true)]), version: 1 });
    for (const enabled of [false, true, false, undefined]) {
      record.mockClear();
      const [patch] = deserializePatch([flag(enabled)]);
      await store.upsert(patch.kind, patch.data);
      expect(client.boolVariationDetail('flag', false).value).toBe(true);
      expect(record).toHaveBeenCalledTimes(enabled === false ? 0 : 1);
    }
  });

  it('keeps custom metric tracking independent of flag insights', async () => {
    await store.init({ ...deserializeAll([flag(false)]), version: 1 });
    client.boolVariation('flag', false);
    client.track('purchase', 5);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.any(MetricEvent));
  });
});

import { FbClientBuilder } from '../../../src/FbClientBuilder';
import { IFbClient } from '../../../src/IFbClient';
import { DataSyncModeEnum } from '../../../src/data-sync/DataSyncMode';
import { hashSerializeUser } from '../../../src/utils/serializeUser';
import { StoreStorageKey } from '../../../src/store/store';

class Socket {
  static OPEN = 1;
  static latest: Socket;
  readyState = 0;
  sent: any[] = [];
  handlers = new Map<string, Array<(event: any) => void>>();
  constructor() { Socket.latest = this; }
  addEventListener(name: string, handler: (event: any) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }
  emit(name: string, event: any = {}) { this.handlers.get(name)?.forEach(handler => handler(event)); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code = 1000) { this.readyState = 3; this.emit('close', { code }); }
  open() { this.readyState = 1; this.emit('open'); }
}

const user = { keyId: 'acceptance-user', name: 'Acceptance' };
const flag = (id: string, timestamp: number, variation = 'enabled', archived = false) => ({
  id, timestamp, variation, variationType: 'string',
  matchReason: archived ? 'flag archived' : 'default',
  variationOptions: [{ id: 1, value: variation }], sendToExperiment: true
});
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const flush = () => jest.advanceTimersByTimeAsync(0);

describe.each([DataSyncModeEnum.STREAMING, DataSyncModeEnum.POLLING])('archive lifecycle via %s', mode => {
  const originalSocket = global.WebSocket;
  const originalFetch = global.fetch;
  let client: IFbClient;
  let requests: Array<{ timestamp: number; respond: (response: any) => void }>;
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    requests = [];
    global.WebSocket = Socket as unknown as typeof WebSocket;
    global.fetch = jest.fn((url: any) => new Promise(resolve => requests.push({
      timestamp: Number(new URL(url).searchParams.get('timestamp')), respond: resolve
    }))) as any;
  });
  afterEach(async () => {
    await client?.close();
    global.WebSocket = originalSocket;
    global.fetch = originalFetch;
    localStorage.clear();
    jest.useRealTimers();
  });

  async function start() {
    client = new FbClientBuilder({
      sdkKey: 'key', user, dataSyncMode: mode, streamingUri: 'ws://example.test',
      pollingUri: 'http://example.test', eventsUri: 'http://example.test',
      pollingInterval: 1000, disableEvents: true, logger,
      bootstrap: [{ id: 'local-only', variation: 'local', variationType: 'string' } as any]
    }).build();
    await flush();
    if (mode === DataSyncModeEnum.STREAMING) Socket.latest.open();
  }
  async function respond(eventType: string, featureFlags: any[]) {
    const body = JSON.stringify({ messageType: 'data-sync', data: { userKeyId: user.keyId, eventType, featureFlags } });
    if (mode === DataSyncModeEnum.STREAMING) Socket.latest.emit('message', { data: body });
    else requests[requests.length - 1].respond({ status: 200, text: async () => body });
    await flush();
  }
  async function nextPatch(flags: any[]) {
    if (mode === DataSyncModeEnum.POLLING) await jest.advanceTimersByTimeAsync(1000);
    await respond('patch', flags);
  }
  function latestTimestamp() {
    return mode === DataSyncModeEnum.STREAMING ? Socket.latest.sent[0].data.timestamp : requests[requests.length - 1].timestamp;
  }

  it('hides archives atomically, persists markers, and reconciles missed deletion on restart', async () => {
    await start();
    await respond('full', [flag('archived', 10), flag('deleted-offline', 10), flag('other', 10)]);
    await client.waitForInitialization();
    const observed: any[] = [];
    client.on('update', keys => observed.push({ keys, archived: client.variation('archived', 'fallback'), other: client.variation('other', 'fallback') }));
    const archivedEvent = jest.fn();
    client.on('update:archived', archivedEvent);
    await nextPatch([flag('archived', 20, 'unused-large-value', true), flag('other', 20, 'changed')]);
    expect(observed).toEqual([{ keys: ['archived', 'other'], archived: 'fallback', other: 'changed' }]);
    expect(archivedEvent).toHaveBeenCalledWith('archived');
    expect((await client.getAllVariations()).map(item => item.flagKey)).not.toContain('archived');
    const key = `${StoreStorageKey}-${await hashSerializeUser(user)}`;
    const cached = () => JSON.parse(localStorage.getItem(key)!);
    expect(Object.keys(cached().flags.archived).sort()).toEqual(['deleted', 'key', 'matchReason', 'origin', 'version']);
    await nextPatch([flag('archived', 19)]);
    expect(observed).toHaveLength(1);
    expect(client.variation('archived', 'fallback')).toBe('fallback');
    await client.close();
    expect(jest.getTimerCount()).toBe(0);

    await start();
    expect(latestTimestamp()).toBe(0);
    expect(cached().version).toBe(20);
    expect(client.variation('archived', 'fallback')).toBe('fallback');
    expect(client.variation('deleted-offline', 'fallback')).toBe('enabled');
    const removed = jest.fn();
    client.on('update', removed);
    await respond('full', []);
    await client.waitForInitialization();
    expect(removed).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls[0][0].sort()).toEqual(['deleted-offline', 'other']);
    expect(client.variation('deleted-offline', 'fallback')).toBe('fallback');
    expect(client.variation('local-only', 'fallback')).toBe('local');
    expect(Object.keys(cached().flags)).toEqual(['local-only']);
    expect(cached().version).toBe(0);
    await client.close();
    expect(jest.getTimerCount()).toBe(0);
  });
});

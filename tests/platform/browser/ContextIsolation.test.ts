import { FbClientBuilder } from '../../../src/FbClientBuilder';
import InMemoryStore from '../../../src/store/InMemoryStore';
import { IFbClient } from '../../../src/IFbClient';

class TestSocket {
  static OPEN = 1;
  static instances: TestSocket[] = [];
  readyState = 0;
  sent: any[] = [];
  private handlers = new Map<string, Array<(event: any) => void>>();
  constructor(_url: string) { TestSocket.instances.push(this); }
  addEventListener(name: string, handler: (event: any) => void) {
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), handler]);
  }
  send(message: string) { this.sent.push(JSON.parse(message)); }
  close(code = 1000) { this.readyState = 3; this.emit('close', { code }); }
  emit(name: string, event: any = {}) { this.handlers.get(name)?.forEach(handler => handler(event)); }
  open() { this.readyState = 1; this.emit('open'); }
  full(value: string) {
    this.emit('message', { data: JSON.stringify({ messageType: 'data-sync', data: {
      userKeyId: 'same-key', eventType: 'full', featureFlags: [
        { id: 'flag', timestamp: 1, variation: value, variationType: 'string', variationOptions: [] }
      ]
    } }) });
  }
}

const user = (plan: string) => ({ keyId: 'same-key', name: 'User', customizedProperties: [{ name: 'plan', value: plan }] });
const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
const flush = () => jest.advanceTimersByTimeAsync(0);

describe('browser context isolation', () => {
  const originalSocket = global.WebSocket;
  let client: IFbClient;
  beforeEach(() => {
    jest.useFakeTimers();
    TestSocket.instances = [];
    global.WebSocket = TestSocket as unknown as typeof WebSocket;
    client = new FbClientBuilder({ store: new InMemoryStore() }).sdkKey('key')
      .user(user('A')).streamingUri('ws://example.test').eventsUri('http://example.test')
      .disableEvents(true).logger(logger).build();
  });
  afterEach(async () => {
    await client.close();
    global.WebSocket = originalSocket;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function initialize() {
    await flush();
    const socket = TestSocket.instances[0];
    socket.open();
    socket.full('A');
    await client.waitForInitialization();
    return socket;
  }

  it('does not replace a connecting socket on pageshow during startup or Identify', async () => {
    await flush();
    const initial = TestSocket.instances[0];
    window.dispatchEvent(new Event('pageshow'));
    expect(TestSocket.instances).toHaveLength(1);
    expect(initial.readyState).toBe(0);
    initial.open();
    initial.full('A');
    await client.waitForInitialization();

    // The previous attempt is old enough that Identify must set its own timestamp.
    jest.setSystemTime(Date.now() + 60000);
    const identifying = client.identify(user('B'));
    await flush();
    const identified = TestSocket.instances[1];
    window.dispatchEvent(new Event('pageshow'));
    expect(TestSocket.instances).toHaveLength(2);
    expect(identified.readyState).toBe(0);
    identified.open();
    identified.full('B');
    await identifying;
    expect(client.variation('flag', 'fallback')).toBe('B');
  });

  it('requests full on startup/Identify, uses incremental reconnects, and refreshes after sleep', async () => {
    await client.close();
    const store = new InMemoryStore();
    await store.identify(user('A'));
    await store.init({ flags: { flag: { key: 'flag', version: 42, origin: 'remote', variation: 'cached' } as any }, version: 42 });
    client = new FbClientBuilder({ store, fullSyncInterval: 60000, webSocketPingInterval: 600000 })
      .sdkKey('key').user(user('A')).streamingUri('ws://example.test').eventsUri('http://example.test')
      .disableEvents(true).logger(logger).build();
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    await flush();
    const initial = TestSocket.instances[TestSocket.instances.length - 1];
    initial.open();
    expect(initial.sent[0].data.timestamp).toBe(0);
    expect(store.version).toBe(42);
    initial.full('fresh');
    await client.waitForInitialization();
    initial.close(1006);
    await jest.advanceTimersByTimeAsync(1000);
    const reconnect = TestSocket.instances[TestSocket.instances.length - 1];
    reconnect.open();
    expect(reconnect.sent[0].data.timestamp).toBe(1);
    // Simulate sleep without firing timers, then resume the page.
    jest.setSystemTime(Date.now() + 60000);
    window.dispatchEvent(new Event('pageshow'));
    const refresh = TestSocket.instances[TestSocket.instances.length - 1];
    expect(refresh).not.toBe(reconnect);
    refresh.open();
    expect(refresh.sent[0].data.timestamp).toBe(0);
    expect(client.variation('flag', 'fallback')).toBe('fresh');
    const count = TestSocket.instances.length;
    window.dispatchEvent(new Event('pageshow'));
    expect(TestSocket.instances).toHaveLength(count);
    // No full response: retry is paced and does not discard the cached value.
    await jest.advanceTimersByTimeAsync(30000);
    const retry = TestSocket.instances[TestSocket.instances.length - 1];
    retry.open();
    expect(retry.sent[0].data.timestamp).toBe(0);
    retry.full('refreshed');
    await flush();
    await jest.advanceTimersByTimeAsync(60000);
    const periodic = TestSocket.instances[TestSocket.instances.length - 1];
    expect(periodic).not.toBe(retry);
    periodic.open();
    expect(periodic.sent[0].data.timestamp).toBe(0);
    const identifying = client.identify(user('A'));
    await flush();
    const identified = TestSocket.instances[TestSocket.instances.length - 1];
    identified.open();
    expect(identified.sent[0].data.timestamp).toBe(0);
    identified.full('identified');
    await identifying;
  });

  it('keeps the pending full request when streaming falls back to polling', async () => {
    await client.close();
    const originalFetch = global.fetch;
    const requests = jest.fn().mockResolvedValue({ status: 200, text: async () => JSON.stringify({
      messageType: 'data-sync', data: { userKeyId: 'same-key', eventType: 'full', featureFlags: [
        { id: 'flag', timestamp: 12, variation: 'polled', variationType: 'string', variationOptions: [] }
      ] }
    }) });
    global.fetch = requests;
    try {
      client = new FbClientBuilder({ store: new InMemoryStore(), enablePollingFallback: true, pollingInterval: 1000 })
        .sdkKey('key').user(user('A')).streamingUri('ws://example.test').pollingUri('http://example.test')
        .eventsUri('http://example.test').disableEvents(true).logger(logger).build();
      await flush();
      const failedSocket = TestSocket.instances[TestSocket.instances.length - 1];
      failedSocket.emit('error');
      await flush();
      await client.waitForInitialization();
      expect(requests.mock.calls[0][0]).toContain('timestamp=0');
      expect(client.variation('flag', 'fallback')).toBe('polled');
      await jest.advanceTimersByTimeAsync(1000);
      expect(requests.mock.calls[1][0]).toContain('timestamp=12');
      await client.close();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('replaces the connection for same-key attribute changes and rejects its old callbacks', async () => {
    const oldSocket = await initialize();
    const changed = jest.fn();
    const ready = jest.fn();
    client.on('update', changed);
    client.on('ready', ready);
    const context = user('B');
    const identifying = client.identify(context);
    context.customizedProperties[0].value = 'caller-mutated';
    expect(client.initialized()).toBe(false);
    expect(client.variation('flag', 'fallback')).toBe('fallback');
    const waiting = client.waitForInitialization();
    await flush();
    const current = TestSocket.instances[1];
    current.open();
    expect(current.sent[0].data.user.customizedProperties[0].value).toBe('B');
    const callsBefore = changed.mock.calls.length;
    oldSocket.full('stale-A');
    oldSocket.emit('error');
    oldSocket.emit('open');
    oldSocket.close(1006);
    await flush();
    expect(TestSocket.instances).toHaveLength(2);
    expect(client.initialized()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(callsBefore);
    expect(ready).not.toHaveBeenCalled();
    current.full('B');
    await identifying;
    await waiting;
    expect(client.variation('flag', 'fallback')).toBe('B');
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('settles superseded Identify calls without letting an A-B-A response complete the new context', async () => {
    const firstA = await initialize();
    const identifyB = client.identify(user('B'));
    await flush();
    const socketB = TestSocket.instances[1];
    socketB.open();
    const identifyA = client.identify(user('A'));
    await flush();
    const secondA = TestSocket.instances[2];
    secondA.open();
    firstA.full('old-A');
    socketB.full('old-B');
    await flush();
    await identifyB;
    expect(client.initialized()).toBe(false);
    expect(client.variation('flag', 'fallback')).toBe('A');
    secondA.full('new-A');
    await identifyA;
    expect(client.variation('flag', 'fallback')).toBe('new-A');
  });

  it('cancels timers and pending Identify when closed, including reconnect callbacks', async () => {
    const initial = await initialize();
    initial.close(1006);
    const identifying = client.identify(user('B'));
    await flush();
    const current = TestSocket.instances[1];
    const ready = jest.fn();
    client.on('ready', ready);
    await client.close();
    await identifying;
    await expect(client.waitForInitialization()).rejects.toThrow('Client closed');
    current.open();
    current.full('late');
    await jest.advanceTimersByTimeAsync(120000);
    expect(TestSocket.instances).toHaveLength(2);
    expect(ready).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

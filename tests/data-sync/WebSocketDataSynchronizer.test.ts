import WebSocketDataSynchronizer from "../../src/data-sync/WebSocketDataSynchronizer";
import { ProcessStreamResponse } from "../../src/data-sync/types";
import ClientContext from "../../src/options/ClientContext";
import { IWebSocketWithEvents } from "../../src/platform/IWebSocket";
import { UserBuilder } from "../../src";

describe('WebSocketDataSynchronizer', () => {
  it('does not complete identify for a rejected response', async () => {
    const eventHandlers = new Map<string, (...args: any[]) => void>();
    const socket = {
      config: jest.fn(),
      identify: jest.fn(() => true),
      connect: jest.fn(),
      close: jest.fn(),
      addListener: jest.fn((eventName: string, handler: (...args: any[]) => void) => {
        eventHandlers.set(eventName, handler);
      }),
      once: jest.fn(),
    } as unknown as IWebSocketWithEvents;

    const processJson = jest.fn<boolean, [string, any]>(() => false);
    const listener: ProcessStreamResponse = {
      deserializeData: flags => flags,
      processJson,
    };
    const listeners = new Map([['put', listener]]) as any;
    const clientContext = {
      logger: undefined,
      streamingUri: 'ws://localhost',
    } as unknown as ClientContext;
    const user = new UserBuilder('current-user').name('current-user').build();
    const synchronizer = new WebSocketDataSynchronizer(
      'sdk-key',
      user,
      clientContext,
      socket,
      () => 0,
      listeners,
      1000,
    );

    let completed = false;
    const identifyPromise = synchronizer.identify(user).then(() => {
      completed = true;
    });

    eventHandlers.get('put')!({
      data: {userKeyId: 'previous-user', featureFlags: []},
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    processJson.mockReturnValue(true);
    eventHandlers.get('put')!({
      data: {userKeyId: 'current-user', featureFlags: []},
    });
    await identifyPromise;
    expect(completed).toBe(true);
  });
});

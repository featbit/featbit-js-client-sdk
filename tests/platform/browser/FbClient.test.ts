import { TestLogger } from "../../../src/integrations";
import { FbClientBuilder, IUser, UserBuilder } from "../../../src";
import testData from "../../bootstrap/featbit-bootstrap.json";

const userKeyId = 'thekey';

const response = {
  data: JSON.stringify({
    messageType: "data-sync",
    data: {
      eventType: "full",
      userKeyId: userKeyId,
      featureFlags: testData
    }
  })
};

// @ts-ignore
global.WebSocket = class extends WebSocket {
  state: number;
  events: any;

  constructor(url: string) {
    super(url);
    // @ts-ignore
    global.sendMsg = null;
    this.state = WebSocket.CLOSED;
    this.events = {};
  }

  get readyState() {
    return this.state;
  }

  addEventListener(event: any, cb: any) {
    if (event === "open") {
      this.state = WebSocket.OPEN;
      setTimeout(cb, 1000);
    } else if(event === "message") {
      this.events[event] = cb;
      setTimeout(() => {
        cb(response);
      }, 1000);
    }
  }

  send(data: string) {
    // @ts-ignore
    const payload = JSON.parse(data);
    if (payload.messageType === 'data-sync') {
      this.events['message'](data);
    }
  }
};

// all tests would pass in this module, but we got some weired logs
// so temporarily this test suite is skipped. To enable it, remove testPathIgnorePatterns in jest.config.js
describe('given a FbClientNode', () => {
  let testLogger: TestLogger;
  let clientUser: IUser;

  beforeEach(() => {
    testLogger = new TestLogger();
    clientUser = new UserBuilder(userKeyId).build();
  });

  it('the fbClient initialized successfully', async () => {
    const fbClient = new FbClientBuilder()
      .sdkKey('sdk-key')
      .streamingUri('ws://localhost:6100')
      .eventsUri('http://localhost:6100')
      .user(clientUser)
      .logger(testLogger)
      .build();

    await fbClient.waitForInitialization();
    expect(fbClient.initialized()).toBe(true);
    await fbClient.close();
  });


  it('get variation', async () => {
    const fbClient = new FbClientBuilder()
      .sdkKey('sdk-key')
      .streamingUri('ws://localhost:6100')
      .eventsUri('http://localhost:6100')
      .user(clientUser)
      .logger(testLogger)
      .build();

    try {
      await fbClient.waitForInitialization();
    } catch(err) {
    }

    expect(fbClient.initialized()).toBeTruthy();
    const variation = await fbClient.boolVariation('flag1', false);

    expect(variation).toEqual(true);
  });

  it('get variation detail', async () => {
    const fbClient = new FbClientBuilder()
      .sdkKey('sdk-key')
      .streamingUri('ws://localhost:6100')
      .eventsUri('http://localhost1:6100')
      .user(clientUser)
      .logger(testLogger)
      .build();

    try {
      await fbClient.waitForInitialization();
    } catch(err) {
    }

    expect(fbClient.initialized()).toBeTruthy();
    const variationDetail = await fbClient.boolVariationDetail('flag1', false);

    expect(variationDetail.value).toBe(true);
    expect(variationDetail.reason).toBe('target match');
    expect(variationDetail.kind).toBe('Match');
  });

  it('get all variations', async () => {
    const fbClient = new FbClientBuilder()
      .sdkKey('sdk-key')
      .streamingUri('ws://localhost:6100')
      .eventsUri('http://localhost1:6100')
      .user(clientUser)
      .logger(testLogger)
      .build();

    try {
      await fbClient.waitForInitialization();
    } catch(err) {
    }

    expect(fbClient.initialized()).toBeTruthy();
    const results = await fbClient.getAllVariations();

    expect(results.length).toBe(1);
    const result0 = results[0];

    expect(result0.value).toBe('true');
    expect(result0.reason).toBe('target match');
    expect(result0.kind).toBe('Match');
  });
});
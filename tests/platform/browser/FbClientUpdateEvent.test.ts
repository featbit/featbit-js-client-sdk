import { FbClientCore } from "../../../src/FbClientCore";
import FbClient from "../../../src/platform/browser/FbClient";

// The core is mocked so each test can grab the onUpdate callback FbClient passes in and call it directly.
jest.mock("../../../src/FbClientCore");

type CoreCallbacks = { onUpdate: (keys: string[]) => void };
type ClientOptions = ConstructorParameters<typeof FbClient>[0];
type FbClientInstance = InstanceType<typeof FbClient>;

const user = { keyId: "thekey", name: "thekey", customizedProperties: [] };

function newClient(): FbClientInstance {
  const options = { sdkKey: "k", user, streamingUri: "ws://x", eventsUri: "http://x" } as unknown as ClientOptions;
  return new FbClient(options);
}

// The most recent FbClientCore construction is the one this test's client made.
function lastCoreCallbacks(): CoreCallbacks {
  const calls = (FbClientCore as unknown as jest.Mock).mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error("FbClientCore was not constructed");
  return last[2] as CoreCallbacks;
}

describe("given a browser FbClient, the update event", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes the changed keys to 'update' listeners as a flat list", () => {
    const client = newClient();
    const listener = jest.fn();
    client.on("update", listener);
    lastCoreCallbacks().onUpdate(["kill-switch-llm", "checkout-cta"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(["kill-switch-llm", "checkout-cta"]);
  });

  it("passes a single changed key as a one-item flat list", () => {
    const client = newClient();
    const listener = jest.fn();
    client.on("update", listener);
    lastCoreCallbacks().onUpdate(["checkout-cta"]);
    expect(listener.mock.calls[0][0]).toEqual(["checkout-cta"]);
  });

  it("still fires the per-flag 'update:KEY' event for each key", () => {
    const client = newClient();
    const perFlag = jest.fn();
    client.on("update:checkout-cta", perFlag);
    lastCoreCallbacks().onUpdate(["kill-switch-llm", "checkout-cta"]);
    expect(perFlag).toHaveBeenCalledWith("checkout-cta");
  });
});

import { FbClientCore } from "../../../src/FbClientCore";
import FbClient from "../../../src/platform/browser/FbClient";

// The core is mocked so the test can grab the onUpdate callback FbClient passes in and call it directly.
jest.mock("../../../src/FbClientCore");

describe("given a browser FbClient, the update event", () => {
  const user = { keyId: "thekey", name: "thekey", customizedProperties: [] };

  it("passes the changed keys to 'update' listeners as a flat list", () => {
    const client = new FbClient({ sdkKey: "k", user, streamingUri: "ws://x", eventsUri: "http://x" } as any);
    const listener = jest.fn();
    client.on("update", listener);
    const callbacks = (FbClientCore as unknown as jest.Mock).mock.calls.at(-1)[2];
    callbacks.onUpdate(["kill-switch-llm", "checkout-cta"]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(["kill-switch-llm", "checkout-cta"]);
  });

  it("still fires the per-flag 'update:KEY' event for each key", () => {
    const client = new FbClient({ sdkKey: "k", user, streamingUri: "ws://x", eventsUri: "http://x" } as any);
    const perFlag = jest.fn();
    client.on("update:checkout-cta", perFlag);
    const callbacks = (FbClientCore as unknown as jest.Mock).mock.calls.at(-1)[2];
    callbacks.onUpdate(["kill-switch-llm", "checkout-cta"]);
    expect(perFlag).toHaveBeenCalledWith("checkout-cta");
  });
});

import DataSourceUpdates from "../../src/data-sources/DataSourceUpdates";
import { createStreamListeners } from "../../src/data-sources/createStreamListeners";
import DataKinds from "../../src/store/DataKinds";
import InMemoryStore from "../../src/store/InMemoryStore";
import { IPatchData } from "../../src/store/serialization";
import { StoreItemOriginEnum } from "../../src/store/store";
import { UserBuilder } from "../../src";
import { VariationDataType } from "../../src/evaluation";

describe('createStreamListeners', () => {
  const currentUserKey = 'current-user';
  const previousUserKey = 'previous-user';

  function createTestContext() {
    const store = new InMemoryStore();
    store.identify(new UserBuilder(currentUserKey).name(currentUserKey).build());

    const dataSourceUpdates = new DataSourceUpdates(store, () => false, () => {});
    const onPutComplete = jest.fn();
    const onPatchComplete = jest.fn();
    const listeners = createStreamListeners(dataSourceUpdates, undefined, {
      put: onPutComplete,
      patch: onPatchComplete,
    });

    return {store, listeners, onPutComplete, onPatchComplete};
  }

  function patch(key: string): IPatchData {
    return {
      kind: DataKinds.Flags,
      data: {
        id: key,
        key,
        version: 1,
        origin: StoreItemOriginEnum.Remote,
        variation: 'true',
        variationType: VariationDataType.boolean,
        variations: [],
        matchReason: 'target match',
      },
    };
  }

  it('does not complete a put for a previous user', () => {
    const {listeners, onPutComplete} = createTestContext();
    const processJson = listeners.get('put')!.processJson;

    expect(processJson(previousUserKey, {flags: {}})).toBe(false);
    expect(onPutComplete).not.toHaveBeenCalled();

    expect(processJson(currentUserKey, {flags: {}})).toBe(true);
    expect(onPutComplete).toHaveBeenCalledTimes(1);
  });

  it('does not complete a patch for a previous user', () => {
    const {store, listeners, onPatchComplete} = createTestContext();
    const processJson = listeners.get('patch')!.processJson;

    expect(processJson(previousUserKey, [patch('flag')])).toBe(false);
    expect(store.get(DataKinds.Flags, 'flag')).toBeNull();
    expect(onPatchComplete).not.toHaveBeenCalled();
  });

  it('checks the current user before completing an empty patch', () => {
    const {listeners, onPatchComplete} = createTestContext();
    const processJson = listeners.get('patch')!.processJson;

    expect(processJson(previousUserKey, [])).toBe(false);
    expect(onPatchComplete).not.toHaveBeenCalled();

    expect(processJson(currentUserKey, [])).toBe(true);
    expect(onPatchComplete).toHaveBeenCalledTimes(1);
  });

  it('completes an accepted patch batch once', () => {
    const {store, listeners, onPatchComplete} = createTestContext();
    const processJson = listeners.get('patch')!.processJson;

    expect(processJson(currentUserKey, [patch('flag-a'), patch('flag-b')])).toBe(true);
    expect(store.get(DataKinds.Flags, 'flag-a')).not.toBeNull();
    expect(store.get(DataKinds.Flags, 'flag-b')).not.toBeNull();
    expect(onPatchComplete).toHaveBeenCalledTimes(1);
  });
});

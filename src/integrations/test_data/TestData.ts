import { IFlag } from "../../evaluation/data/IFlag.js";
import TestDataSynchronizer from "./TestDataSynchronizer.js";
import { IClientContext } from "../../options/IClientContext.js";
import { IDataSourceUpdates } from "../../store/IDataSourceUpdates.js";
import { VoidFunction } from "../../utils/VoidFunction.js";
import { createStreamListeners } from "../../data-sources/createStreamListeners.js";
import { IStore } from "../../platform/IStore.js";
import DataKinds from "../../store/DataKinds.js";

export default class TestData {
  private currentFlags: IFlag[] = [];

  private dataSynchronizer: TestDataSynchronizer | undefined;

  private store: IStore = {} as IStore;

  /**
   * Get a factory for update processors that will be attached to this TestData instance.
   * @returns An update processor factory.
   */
  getFactory() {
    // Provides an arrow function to prevent needed to bind the method to
    // maintain `this`.
    return (
      clientContext: IClientContext,
      store: IStore,
      dataSourceUpdates: IDataSourceUpdates,
      initSuccessHandler: VoidFunction,
      errorHandler?: (e: Error) => void,
    ) => {
      this.store = store;

      const listeners = createStreamListeners(
        dataSourceUpdates,
        clientContext.logger,
        {
          put: initSuccessHandler,
        },
      );

      this.dataSynchronizer = new TestDataSynchronizer(
        dataSourceUpdates,
        Object.values(this.currentFlags),
        () => {},
        listeners,
        store.user.keyId,
        errorHandler,
      );

      return this.dataSynchronizer;
    }
  }

  update(flag: IFlag): Promise<void> {
    const oldVersion = this.store.get(DataKinds.Flags, flag.id)?.version || 0;
    const newFlag = { ...flag, version: oldVersion + 1, key: flag.id };

    return this.dataSynchronizer!.upsert(DataKinds.Flags, newFlag);
  }
}

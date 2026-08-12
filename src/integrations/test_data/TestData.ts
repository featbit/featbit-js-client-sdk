import { IFlag } from "../../evaluation/data/IFlag";
import TestDataSynchronizer from "./TestDataSynchronizer";
import { IClientContext } from "../../options/IClientContext";
import { IDataSourceUpdates } from "../../store/IDataSourceUpdates";
import { VoidFunction } from "../../utils/VoidFunction";
import { createStreamListeners } from "../../data-sources/createStreamListeners";
import { IStore } from "../../platform/IStore";
import DataKinds from "../../store/DataKinds";

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
      _errorHandler?: (e: Error) => void,
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
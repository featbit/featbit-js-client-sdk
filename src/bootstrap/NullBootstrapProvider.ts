import { IBootstrapProvider } from "./IBootstrapProvider.js";
import { IDataSourceUpdates } from "../store/IDataSourceUpdates.js";
import { IStoreDataStorage } from "../store/store.js";

export class NullBootstrapProvider implements IBootstrapProvider {
  private dataSet?: IStoreDataStorage;

  constructor() {
    this.dataSet = {
      flags: {},
      version: 0
    };
  }

  populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates, callback?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      resolve();
      callback?.();
    });
  }
}
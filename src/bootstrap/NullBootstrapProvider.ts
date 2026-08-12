import { IBootstrapProvider } from "./IBootstrapProvider";
import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import { IStoreDataStorage } from "../store/store";

export class NullBootstrapProvider implements IBootstrapProvider {
  private dataSet?: IStoreDataStorage;

  constructor() {
    this.dataSet = {
      flags: {},
      version: 0
    };
  }

  populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates): void {}
}

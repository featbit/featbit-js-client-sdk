import { IDataSourceUpdates } from "../store/IDataSourceUpdates.js";

export interface IBootstrapProvider {
  populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates, callback?: () => void): Promise<void>
}
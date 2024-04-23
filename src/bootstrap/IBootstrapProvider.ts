import { IDataSourceUpdates } from "../store/IDataSourceUpdates";

export interface IBootstrapProvider {
  populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates, callback?: () => void): Promise<void>
}
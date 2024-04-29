import { IBootstrapProvider } from "./IBootstrapProvider";
import { deserializeAll } from "../store/serialization";
import { IDataSourceUpdates } from "../store/IDataSourceUpdates";
import { IStoreDataStorage } from "../store/store";
import { isNullOrUndefined } from "../utils/isNullOrUndefined";
import { IFlag, IFlagBase } from "../evaluation/data/IFlag";

export class JsonBootstrapProvider implements IBootstrapProvider {
  private dataSet?: IStoreDataStorage;

  constructor(bootstrap: IFlagBase[]) {
    const flags: IFlag[] = (bootstrap || []).map((flag: IFlagBase) => ({...flag, variationOptions: flag.variationOptions || [{id: null, variation: flag.variation}]})) as IFlag[];

    const data = deserializeAll(flags);
    this.dataSet = {
      flags: data.flags,
      version: 0
    };
  }

  populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates, callback?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (isNullOrUndefined(this.dataSet)) {
        return resolve();
      }

      const internalCallback = () => {
        resolve();
        callback?.();
      }

      dataSourceUpdates.init(userKeyId, this.dataSet!, internalCallback);
    });
  }
}
import { IBootstrapProvider } from "./IBootstrapProvider.js";
import { deserializeAll } from "../store/serialization.js";
import { IDataSourceUpdates } from "../store/IDataSourceUpdates.js";
import { IStoreDataStorage, StoreItemOriginEnum } from "../store/store.js";
import { isNullOrUndefined } from "../utils/isNullOrUndefined.js";
import { IFlag, IFlagBase } from "../evaluation/data/IFlag.js";

export class JsonBootstrapProvider implements IBootstrapProvider {
  private dataSet?: IStoreDataStorage;

  constructor(bootstrap: IFlagBase[]) {
    const flags: IFlag[] = (bootstrap || []).map((flag: IFlagBase) => ({...flag, origin: StoreItemOriginEnum.Local, variationOptions: flag.variationOptions || [{id: null, variation: flag.variation}]})) as IFlag[];

    const data = deserializeAll(flags);
    this.dataSet = {
      flags: data.flags,
      version: 0
    };
  }

  async populate(userKeyId: string, dataSourceUpdates: IDataSourceUpdates, callback?: () => void): Promise<void> {
    if (!isNullOrUndefined(this.dataSet)) {
      await dataSourceUpdates.init(userKeyId, this.dataSet!, callback);
    }
  }
}

import { IFlag } from "../evaluation/data/IFlag";
import DataKinds from "./DataKinds";
import { IVersionedData } from "../IVersionedData";
import { IDataKind } from "../IDataKind";

export interface Flags {
  flags: { [name: string]: IFlag };
}

type VersionedFlag = IVersionedData & IFlag;

export interface IPatchData {
  data: VersionedFlag;
  kind: IDataKind;
}

/**
 * @internal
 */
export function deserializeAll(flags: IFlag[]): Flags {
  const result = {
    [DataKinds.Flags.namespace]: {}
  };

  if (flags?.length) {
    result[DataKinds.Flags.namespace] = flags.reduce((acc: any, cur: any) => {
      acc[cur.id] = {...cur, version: cur.timestamp || 0, key: cur.id, variations: cur.variationOptions};
      return acc;
    }, {});
  }

  return result as any as Flags;
}

/**
 * @internal
 */
export function deserializePatch(flags: IFlag[]): IPatchData[] {
  const result = [
    ...flags?.map(item => ({
      data: {
        ...item,
        version:item.timestamp,
        key: item.id,
        variations: item.variationOptions
      },
      kind: DataKinds.Flags
    })) || []
  ];

  return result as any as IPatchData[];
}

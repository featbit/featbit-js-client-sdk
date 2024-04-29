export type FlagValue = any;

export enum VariationDataType {
  string = 'string',
  boolean = 'boolean',
  number = 'number',
  json = 'json',
  empty = ''
}

export interface IVariation {
  id: number,
  value: FlagValue
}

export interface IFlagBase {
  id: string, // the key
  variation: FlagValue,
  variationType: VariationDataType,
  sendToExperiment?: boolean,
  timestamp?: number,
  variationOptions?: IVariation[],
}

export interface IFlag extends IFlagBase {
  key: string, // the same value to id
  variations: IVariation[],// the same value to variationOptions
  version: number
}

export type FeatureFlagValue = any;

export interface IFeatureFlagSet {
  [key: string]: FeatureFlagValue;
}

export interface IFeatureFlagChange {
  id: string,
  oldValue: FeatureFlagValue,
  newValue: FeatureFlagValue
}

export interface IOption {
  secret: string,
  anonymous?: boolean,
  bootstrap?: IFeatureFlag[],
  api?: string,
  appType?: string,
  user?: IUser,
  enableDataSync?: boolean
}

export interface IUser {
  name: string,
  keyId: string,
  customizedProperties?: ICustomizedProperty[]
}

export interface ICustomizedProperty {
  name: string,
  value: string | number | boolean
}

export interface IVariationOption {
  id: number,
  value: FeatureFlagValue
}

export interface IFeatureFlagVariation {
  id?: string,
  sendToExperiment?: boolean
  timestamp?: number,
  variation?: {
    id: number,
    value: FeatureFlagValue,
  }
}

export interface IFeatureFlagVariationBuffer {
  id: string,
  timestamp: number,
  variationValue: FeatureFlagValue
}

export enum InsightType {
  featureFlagUsage = 1,
  customEvent = 2,
  pageView = 3,
  click = 4
}

export enum VariationDataType {
  string = 'string',
  boolean = 'boolean',
  number = 'number',
  json = 'json',
}

export interface IInsight extends IFeatureFlagVariation, ICustomEvent {
  insightType: InsightType
}

export interface IFeatureFlagBase {
  id: string, // the keyname
  variation: FeatureFlagValue,
  variationType: VariationDataType
}

export interface IFeatureFlag extends IFeatureFlagBase{
  sendToExperiment: boolean,
  timestamp: number,
  variationOptions: IVariationOption[]
}

export interface IDataStore {
  featureFlags: { [key: string]: IFeatureFlag }
}

export enum StreamResponseEventType {
  full = 'full',
  patch = 'patch'
}

export enum FeatureFlagUpdateOperation {
  update = 'update'
}

export interface IStreamResponse {
  eventType: StreamResponseEventType,
  userKeyId: string,
  featureFlags: IFeatureFlag[]
}

export interface ICustomEvent {
  type?: string,
  eventName: string,
  numericValue?: number
}
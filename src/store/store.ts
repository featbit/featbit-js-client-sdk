export const StoreStorageKey = 'fb-datastore';

export const CurrentUserStorageKey = 'fb-user';

/**
 * Represents an item which can be stored in the feature store.
 */
export interface IStoreItem {
  version: number;

  // The actual data associated with the item.
  [attribute: string]: any;
}

/**
 * When upserting an item it must contain a key.
 */
export interface IKeyedStoreItem extends IStoreItem {
  key: string;
}

/**
 * Represents the storage for a single kind of data. e.g. 'flag' or 'segment'.
 */
export interface IStoreKindData {
  [key: string]: IStoreItem;
}

/**
 * Represents the storage for the full data store.
 */
export interface IStoreDataStorage {
  flags: IStoreKindData;
  version: number;

  // This attribute is to ingore the type check error
  [attribute: string]: any;
}
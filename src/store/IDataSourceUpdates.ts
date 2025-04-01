import { IDataKind } from "../IDataKind";
import { IStoreDataStorage, IKeyedStoreItem } from "./store";

/**
 * Interface that a data source implementation will use to push data into the SDK.
 *
 * The data source interacts with this object, rather than manipulating the data store directly, so
 * that the SDK can perform any other necessary operations that must happen when data is updated.
 */
export interface IDataSourceUpdates {
  /**
   * Completely overwrites the current contents of the data store with a set of items for each
   * collection.
   *
   * @param userKeyId
   *  The key ID of the user whose data is being updated.
   *
   * @param allData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   */
  init(userKeyId: string, allData: IStoreDataStorage, callback?: () => void): void;

  /**
   * Compare old and new data, check if any update exists
   * If update exists, send onUpdate events
   *
   * @param oldData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   *
   * @param newData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   *
   * @param callback
   *   Will be called when the store has been initialized.
   */
  checkUpdates(oldData: IStoreDataStorage, newData: IStoreDataStorage, callback?: () => void): void;

  /**
   * Updates or inserts an item in the specified collection. For updates, the object will only be
   * updated if the existing version is less than the new version.
   *
   * @param userKeyId
   *  The key ID of the user whose data is being updated.
   *
   * @param kind
   *   The type of data to be accessed. The actual type of this parameter is
   *   {@link IDataKind}.
   *
   * @param data
   *   The contents of the entity, as an object that can be converted to JSON. The store
   *   should check the `version` property of this object, and should *not* overwrite any
   *   existing data if the existing `version` is greater than or equal to that value.
   *   The actual type of this parameter is {@link IKeyedStoreItem}.
   *
   * @param callback
   *   Will be called after the upsert operation is complete.
   */
  upsert(userKeyId: string, kind: IDataKind, data: IKeyedStoreItem, callback: () => void): void;
}

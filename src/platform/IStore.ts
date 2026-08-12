import { IDataKind } from "../IDataKind";
import { IKeyedStoreItem, IStoreDataStorage, IStoreItem, IStoreKindData } from "../store/store";
import { IUser } from "../options/IUser";

/**
 * Interface for a feature store component.
 *
 * The feature store is what the client uses to store feature flag data that has been received
 * from FeatBit. By default, it uses an in-memory implementation; database integrations are
 * also available. Read the [SDK features guide](xxx).
 * You will not need to use this interface unless you are writing your own implementation.
 *
 * Feature store methods can and should call their callbacks directly whenever possible, rather
 * than deferring them with setImmediate() or process.nextTick(). This means that if for any
 * reason you are updating or querying a feature store directly in your application code (which
 * is not part of normal use of the SDK) you should be aware that the callback may be executed
 * immediately.
 */
export interface IStore {
  /**
   * Set the current user of the store.
   *
   * @param user
   *   The current user. The actual type of this parameter is
   *   {@link IUser}.
   */
  identify(user: IUser): Promise<void>;

  /**
   * Get the current user of the store.
   */
  user: IUser;

  /**
   * Get an entity from the store.
   *
   * The store should treat any entity with the property `deleted: true` as "not found".
   *
   * @param kind
   *   The type of data to be accessed. The store should not make any assumptions about the format
   *   of the data, but just return a JSON object. The actual type of this parameter is
   *   {@link DataKind}.
   *
   * @param key
   *   The unique key of the entity within the specified collection.
   */
  get(kind: IDataKind, key: string): IStoreItem | null

  /**
   * Get all entities from a collection.
   *
   * The store should filter out any entities with the property `deleted: true`.
   *
   * @param kind
   *   The type of data to be accessed. The store should not make any assumptions about the format
   *   of the data, but just return an object in which each key is the `key` property of an entity
   *   and the value is the entity. The actual type of this parameter is
   *   {@link IDataKind}.
   */
  all(kind: IDataKind): [IStoreKindData, number];

  /**
   * Initialize the store, overwriting any existing data.
   *
   * @param allData
   *   An object in which each key is the "namespace" of a collection (e.g. `"features"`) and
   *   the value is an object that maps keys to entities. The actual type of this parameter is
   *   `interfaces.FullDataSet<VersionedData>`.
   */
  init(allData: IStoreDataStorage): Promise<void>;

  /**
   * Add an entity or update an existing entity.
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
   */
  upsert(kind: IDataKind, data: IKeyedStoreItem): Promise<void>;

  /**
   * Tests whether the store is initialized.
   *
   * "Initialized" means that the store has been populated with data, either by the client
   * having called `init()` within this process, or by another process (if this is a shared
   * database).
   *
   * @param callback
   *   Will be called back with the boolean result.
   */
  initialized(): boolean;

  /**
   * Releases any resources being used by the feature store.
   */
  close(): void;

  /**
   * Get a description of the store.
   */
  getDescription?(): string;

  /**
   * The current version of the store.
   */
  version: number;
}
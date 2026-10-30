import { IDataSourceUpdates } from "../store/IDataSourceUpdates.js";
import { IKeyedStoreItem, IStoreDataStorage, IStoreItem, IStoreKindData, IStoreUpdate, StoreItemOriginEnum } from "../store/store.js";
import { IStore } from "../platform/IStore.js";
import { IDataKind } from "../IDataKind.js";
import DataKinds from "../store/DataKinds.js";
import { IUser } from '../options/IUser.js';
import { copyUser } from '../utils/copyUser.js';
import { ILogger } from '../logging/ILogger.js';

/** @internal */
export default class DataSourceUpdates implements IDataSourceUpdates {
  private pending: Promise<void> = Promise.resolve();
  private generation = 0;

  invalidateContext(): void {
    ++this.generation;
  }

  identify(user: IUser): Promise<void> {
    const generation = ++this.generation;
    const context = copyUser(user);
    return this.enqueue(async () => {
      if (generation === this.generation) await this.store.identify(context);
    });
  }

  constructor(
    private readonly store: IStore,
    private readonly hasEventListeners: () => boolean,
    private readonly onChange: (keys: string[]) => void,
    private readonly logger?: ILogger,
  ) {
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.pending.then(operation);
    // Report failure to the caller without blocking subsequent responses.
    this.pending = result.catch(() => {});
    return result;
  }

  private visibleFlags(flags: IStoreKindData): IStoreKindData {
    return Object.fromEntries(Object.entries(flags)
      .filter(([, item]) => item && !item.deleted && item.matchReason !== 'flag archived')
      .map(([key, item]) => [key, { ...item }]));
  }

  private snapshot(): IStoreKindData {
    return this.visibleFlags(this.store.all(DataKinds.Flags)[0]);
  }

  private notifyChanges(oldFlags: IStoreKindData, newFlags: IStoreKindData): void {
    if (!this.hasEventListeners()) return;
    const keys = new Set([...Object.keys(oldFlags), ...Object.keys(newFlags)]);
    const changed = [...keys].filter(key => this.isUpdated(oldFlags[key], newFlags[key]));
    if (changed.length > 0) {
      try {
        this.onChange(changed);
      } catch (error) {
        // Application listeners must not prevent sync completion or restarting after Identify.
        this.logger?.warn('An update listener threw an error', error);
      }
    }
  }

  init(userKeyId: string, newData: IStoreDataStorage, callback?: () => void, isCurrent = () => true): Promise<void> {
    const generation = this.generation;
    const flags = { ...newData.flags };
    return this.enqueue(async () => {
      if (generation !== this.generation || !isCurrent() || userKeyId !== this.store.user.keyId) {
        return;
      }

      const oldFlags = this.snapshot();
      const isLocal = Object.values(flags).some(item => item.origin === StoreItemOriginEnum.Local);
      const localOnlyFlags = isLocal ? {} : Object.fromEntries(Object.entries(oldFlags)
        .filter(([key, item]) => item.origin === StoreItemOriginEnum.Local &&
          !Object.prototype.hasOwnProperty.call(flags, key)));

      // Only still-local values survive omission. A remote archive has already
      // replaced the local value, so a later full response cannot resurrect it.
      await this.store.init({ version: newData.version, flags: { ...localOnlyFlags, ...flags } });
      if (generation !== this.generation || !isCurrent()) return;
      this.notifyChanges(oldFlags, this.snapshot());
      if (generation === this.generation && isCurrent()) callback?.();
    });
  }

  checkUpdates(oldData: IStoreDataStorage, newData: IStoreDataStorage, callback?: () => void): void {
    this.notifyChanges(this.visibleFlags(oldData.flags), this.visibleFlags(newData.flags));
    callback?.();
  }

  upsert(userKeyId: string, kind: IDataKind, data: IKeyedStoreItem, callback: () => void): Promise<void> {
    return this.upsertBatch(userKeyId, [{ kind, data }], callback);
  }

  upsertBatch(userKeyId: string, updates: IStoreUpdate[], callback?: () => void, isCurrent = () => true): Promise<void> {
    const generation = this.generation;
    const batch = updates.map(({ kind, data }) => ({ kind: { ...kind }, data: { ...data } }));
    return this.enqueue(async () => {
      if (generation !== this.generation || !isCurrent() || userKeyId !== this.store.user.keyId) {
        return;
      }

      const oldFlags = this.snapshot();
      await this.store.upsertBatch(batch);
      if (generation !== this.generation || !isCurrent()) return;
      this.notifyChanges(oldFlags, this.snapshot());
      if (generation === this.generation && isCurrent()) callback?.();
    });
  }

  private isUpdated(oldData?: IStoreItem, newData?: IStoreItem): boolean {
    if (!oldData && !newData) return false;
    if (!oldData || !newData) return true;
    // Compare committed values, not incoming versions: full replacements may
    // lower versions, and ignored patches must not generate update events.
    return oldData.variation !== newData.variation || oldData.variationType !== newData.variationType;
  }
}

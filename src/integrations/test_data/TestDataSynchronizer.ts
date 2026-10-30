import { IDataSynchronizer } from "../../data-sync/IDataSynchronizer.js";
import { IFlag } from "../../evaluation/data/IFlag.js";
import { EventName, ProcessStreamResponse } from "../../data-sync/types.js";
import { IDataSourceUpdates } from "../../store/IDataSourceUpdates.js";
import { VoidFunction } from "../../utils/VoidFunction.js";
import { IDataKind } from "../../IDataKind.js";
import { IKeyedStoreItem } from "../../store/store.js";
import { IUser } from '../../options/IUser.js';

export default class TestDataSynchronizer implements IDataSynchronizer {
  private readonly flags: IFlag[];
  private generation = 0;
  private stopped = true;

  constructor(
    private dataSourceUpdates: IDataSourceUpdates,
    initialFlags: IFlag[],
    private readonly onStop: VoidFunction,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private userKeyId: string,
    private readonly errorHandler?: (error: Error) => void,
  ) {
    // make copies of these objects to decouple them from the originals
    // so updates made to the originals don't affect these internal data.
    this.flags = [...initialFlags];
  }

  start(): void {
    this.stopped = false;
    const generation = ++this.generation;
    const isCurrent = () => !this.stopped && generation === this.generation;
    const listener = this.listeners.get('put')!;
    // Follow the synchronous start contract and report asynchronous work through
    // the existing completion/error callbacks, just like the network sources.
    listener.processJson(this.userKeyId, listener.deserializeData(this.flags), isCurrent).catch(error => {
      if (isCurrent()) this.errorHandler?.(error);
    });
  }

  async identify(user: IUser): Promise<void> {
    this.userKeyId = user.keyId;
  }

  stop() {
    this.stopped = true;
    ++this.generation;
    this.onStop();
  }

  close() {
    this.stop();
  }

  async upsert(kind: IDataKind, value: IKeyedStoreItem) {
    const flag = {
      ...value, id: value.key, timestamp: value.version,
      variationOptions: value.variations ?? value.variationOptions
    } as IFlag;
    const index = this.flags.findIndex(item => item.id === flag.id);
    if (index === -1) this.flags.push(flag);
    else this.flags[index] = flag;
    if (this.stopped) return;
    const generation = this.generation;
    await this.dataSourceUpdates.upsertBatch(this.userKeyId, [{ kind, data: value }], undefined,
      () => !this.stopped && generation === this.generation);
  }
}

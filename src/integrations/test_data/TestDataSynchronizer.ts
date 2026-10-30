import { IDataSynchronizer } from "../../data-sync/IDataSynchronizer";
import { IFlag } from "../../evaluation/data/IFlag";
import { EventName, ProcessStreamResponse } from "../../data-sync/types";
import { IDataSourceUpdates } from "../../store/IDataSourceUpdates";
import { VoidFunction } from "../../utils/VoidFunction";
import { IDataKind } from "../../IDataKind";
import { IKeyedStoreItem } from "../../store/store";
import { IUser } from '../../options/IUser';

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
  ) {
    // make copies of these objects to decouple them from the originals
    // so updates made to the originals don't affect these internal data.
    this.flags = [...initialFlags];
  }

  async start() {
    this.stopped = false;
    const generation = ++this.generation;
    const isCurrent = () => !this.stopped && generation === this.generation;
    const listener = this.listeners.get('put')!;
    await listener.processJson(this.userKeyId, listener.deserializeData(this.flags), isCurrent);
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
    const flag = { ...value, id: value.key, timestamp: value.version } as IFlag;
    const index = this.flags.findIndex(item => item.id === flag.id);
    if (index === -1) this.flags.push(flag);
    else this.flags[index] = flag;
    if (this.stopped) return;
    const generation = this.generation;
    await this.dataSourceUpdates.upsertBatch(this.userKeyId, [{ kind, data: value }], undefined,
      () => !this.stopped && generation === this.generation);
  }
}

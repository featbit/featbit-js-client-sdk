import { IDataSynchronizer } from "../../data-sync/IDataSynchronizer";
import { IFlag } from "../../evaluation/data/IFlag";
import { EventName, ProcessStreamResponse } from "../../data-sync/types";
import { IDataSourceUpdates } from "../../store/IDataSourceUpdates";
import { VoidFunction } from "../../utils/VoidFunction";
import { IDataKind } from "../../IDataKind";
import { IKeyedStoreItem } from "../../store/store";

export default class TestDataSynchronizer implements IDataSynchronizer {
  private readonly flags: IFlag[];
  private readonly userKeyId: string = 'test-user-key-id';

  constructor(
    private dataSourceUpdates: IDataSourceUpdates,
    initialFlags: IFlag[],
    private readonly onStop: VoidFunction,
    private readonly listeners: Map<EventName, ProcessStreamResponse>
  ) {
    // make copies of these objects to decouple them from the originals
    // so updates made to the originals don't affect these internal data.
    this.flags = [...initialFlags];
  }

  async start() {
    this.listeners.forEach(({deserializeData, processJson }) => {
      const data = deserializeData(this.flags);
      processJson(this.userKeyId, data);
    });
  }

  identify() {
    // no-op
  }

  stop() {
    this.onStop();
  }

  close() {
    this.stop();
  }

  async upsert(kind: IDataKind, value: IKeyedStoreItem) {
    return new Promise<void>((resolve) => {
      this.dataSourceUpdates.upsert(this.userKeyId, kind, value, () => {
        resolve();
      });
    });
  }
}
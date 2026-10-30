import { IDataSynchronizer } from "./IDataSynchronizer.js";

export class NullDataSynchronizer implements IDataSynchronizer {
  close(): void {
  }

  start(): void {
  }

  stop(): void {
  }

  async identify(): Promise<void> {
  }
}
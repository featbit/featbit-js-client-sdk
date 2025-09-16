import { IDataSynchronizer } from "./IDataSynchronizer";

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
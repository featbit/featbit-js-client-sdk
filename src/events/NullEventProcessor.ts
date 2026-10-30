import { IEventProcessor } from "./IEventProcessor.js";
import { IEvent } from "./event.js";

export class NullEventProcessor implements IEventProcessor {
  flush(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  record(event: IEvent | null): boolean {
    return false;
  }
}
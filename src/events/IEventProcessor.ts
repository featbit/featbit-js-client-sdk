import { IEvent } from "./event.js";

export interface IEventProcessor {
  close(): Promise<void>;

  flush(): Promise<void>;

  record(event: IEvent | null): boolean;
}
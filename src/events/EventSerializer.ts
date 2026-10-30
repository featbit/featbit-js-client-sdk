import { IEvent } from "./event.js";

export interface IEventSerializer {
  serialize(events: IEvent[]): string;
}
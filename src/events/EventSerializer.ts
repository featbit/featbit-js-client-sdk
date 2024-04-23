import { IEvent } from "./event";

export interface IEventSerializer {
  serialize(events: IEvent[]): string;
}
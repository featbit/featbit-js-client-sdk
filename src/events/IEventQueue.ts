import { IEvent } from "./event";

export interface IEventQueue {
  addEvent(event: IEvent): boolean;

  clear(): void;

  shift(): IEvent | undefined;

  close(): void;

  get eventsSnapshot(): IEvent[];

  get length(): number;

  get isEmpty(): boolean;
}
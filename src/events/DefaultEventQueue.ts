import { IEventQueue } from "./IEventQueue";
import { IEvent } from "./event";
import { ILogger } from "../logging/ILogger";

export class DefaultEventQueue implements IEventQueue {
  private events: IEvent[];
  private closed: boolean = false;

  constructor(private readonly capacity: number, private readonly logger: ILogger) {
    this.events = [];
  }

  addEvent(event: IEvent): boolean {
    if (this.closed) {
      return false;
    }

    if (this.events.length >= this.capacity) {
      this.logger.warn("Events are being produced faster than they can be processed. We shouldn't see this.");
      return false;
    }

    this.events.push(event);
    return true;
  }

  clear(): void {
    this.events = [];
  }

  shift(): IEvent | undefined {
    return this.events.shift();
  }

  close(): void {
    this.closed = true;
  }

  get eventsSnapshot(): IEvent[] {
    return [...this.events];
  }

  get length(): number {
    return this.events.length;
  }

  get isEmpty(): boolean {
    return this.length === 0;
  }
}
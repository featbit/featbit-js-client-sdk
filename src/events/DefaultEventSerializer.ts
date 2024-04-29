import { IEventSerializer } from "./EventSerializer";
import { EvalEvent, IEvent, MetricEvent } from "./event";

export class DefaultEventSerializer implements IEventSerializer {
  serialize(events: IEvent[]): string {
    const payload = events
      .map(event => event instanceof EvalEvent || event instanceof MetricEvent ? event.toPayload() : null)
      .filter(event => event !== null);

    return JSON.stringify(payload);
  }
}
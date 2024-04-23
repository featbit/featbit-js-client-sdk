import { IUser } from "../options/IUser";
import { IVariation } from "../evaluation/data/IFlag";

export interface IEvent {
  hash: string;
}

export class AsyncEvent implements IEvent {
  private readonly isCompletedPromise?: Promise<AsyncEvent>;
  private resolveFn?: (value: AsyncEvent) => void;
  timestamp = (new Date()).getTime();

  get hash(): string {
    return this.timestamp.toString();
  }

  constructor() {
    this.isCompletedPromise = new Promise<AsyncEvent>((resolve) => {
      this.resolveFn = resolve;
    });
  }

  waitForCompletion(): Promise<AsyncEvent> {
    return this.isCompletedPromise!;
  }

  complete() {
    this.resolveFn?.(this);
  }
}

export class FlushEvent extends AsyncEvent {
}

export class ShutdownEvent extends AsyncEvent {
}

export class PayloadEvent implements IEvent {
  timestamp = (new Date()).getTime();

  get hash(): string {
    return this.timestamp.toString();
  }

  toPayload(): any {
  };
}

export class MetricEvent extends PayloadEvent {
  constructor(
    public user: IUser,
    public eventName: string,
    public appType: string,
    public metricValue: number
  ) {
    super();
  }

  private userPayload() {
    return {
      keyId: this.user.keyId,
      name: this.user.name,
      customizedProperties: this.user.customizedProperties
    }
  }

  toPayload(): any {
    return {
      user: this.userPayload(),
      metrics: [{
        route: 'index/metric',
        timestamp: this.timestamp,
        numericValue: this.metricValue,
        appType: this.appType,
        eventName: this.eventName,
        type: 'CustomEvent'
      }]
    }
  }

  get hash(): string {
    const payload = this.toPayload();
    const hasObject = {
      user: payload.user,
      metrics: payload.metrics.map((m: any) => ({...m, timestamp: undefined}))
    }
    return JSON.stringify(hasObject);
  }
}

export class EvalEvent extends PayloadEvent {
  constructor(
    public user: IUser,
    public flagKey: string,
    public variation: IVariation,
    public sendToExperiment: boolean
  ) {
    super();
  }

  private userPayload() {
    return {
      keyId: this.user.keyId,
      name: this.user.name,
      customizedProperties: this.user.customizedProperties
    }
  }

  toPayload(): any {
    return {
      user: this.userPayload(),
      variations: [{
        featureFlagKey: this.flagKey,
        sendToExperiment: this.sendToExperiment,
        timestamp: this.timestamp,
        variation: this.variation
      }]
    }
  }

  get hash(): string {
    const payload = this.toPayload();
    const hasObject = {
      user: payload.user,
      variations: payload.variations.map((m: any) => ({...m, timestamp: undefined}))
    }

    return JSON.stringify(hasObject);
  }
}
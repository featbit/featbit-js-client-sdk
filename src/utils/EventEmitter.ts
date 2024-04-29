import { ILogger } from "../logging/ILogger";
import { IEventEmitter } from "./IEventEmitter";

interface Events {
  [key: string | symbol]: {
    handler: (...args: any[]) => void;
    context: any;
  }[];
}

export class EventEmitter implements IEventEmitter {
  private events: Events = {};

  constructor(private logger?: ILogger) {}

  private listeningTo (event: string) {
    return !!this.events[event];
  }

  on (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    this.events[event] = this.events[event] || [];
    this.events[event] = this.events[event].concat({
      handler: handler,
      context: context,
    });

    return this;
  }

  addListener (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    return this.on(event, handler, context);
  }

  once (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    const onceHandler = (...args: any[]) => {
      this.off(event, onceHandler, context);
      handler.apply(context, args);
    };
    return this.on(event, onceHandler, context);
  }

  off (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    if (!this.events[event]) {
      return this;
    }
    for (let i = 0; i < this.events[event].length; i++) {
      if (this.events[event][i].handler === handler && this.events[event][i].context === context) {
        this.events[event] = this.events[event].slice(0, i).concat(this.events[event].slice(i + 1));
      }
    }

    return this;
  }

  removeListener (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    return this.off(event, handler, context);
  }

  removeAllListeners (event?: string | symbol): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }

    return this;
  }

  listeners (event: string | symbol): Function[] {
    return this.events[event] ? this.events[event].map((event) => event.handler) : [];
  }

  emit (event: string | symbol, ...args: any[]): this {
    if (!this.events[event]) {
      return this;
    }
    // Copy the list of handlers before iterating, in case any handler adds or removes another handler.
    // Any such changes should not affect what we do here-- we want to notify every handler that existed
    // at the moment that the event was fired.
    const copiedHandlers = [...this.events[event]];
    for (let i = 0; i < copiedHandlers.length; i++) {
      copiedHandlers[i].handler.apply(copiedHandlers[i].context, Array.prototype.slice.call(arguments, 1));
    }

    return this;
  }

  listenerCount (event: string | symbol): number {
    return this.events[event] ? this.events[event].length : 0;
  }

  prependListener (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    this.events[event] = this.events[event] || [];
    this.events[event] = [
      {
        handler: handler,
        context: context,
      },
      ...this.events[event]
    ];

    return this;
  }

  prependOnceListener (event: string | symbol, handler: (...args: any[]) => void, context?: any): this {
    const onceHandler = (...args: any[]) => {
      this.off(event, onceHandler, context);
      handler.apply(context, args);
    };
    return this.prependListener(event, onceHandler, context);
  }

  eventNames (): (string | symbol)[] {
    return Object.keys(this.events);
  }

  maybeReportError (error: any): this {
    if (!error) {
      return this;
    }
    if (this.listeningTo('error')) {
      this.emit('error', error);
    } else {
      this.logger?.error(error);
    }

    return this;
  }
}
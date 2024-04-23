import { IEventEmitter } from "./IEventEmitter";

export type EventableConstructor<T = {}> = new (...args: any[]) => T;
export type Eventable = EventableConstructor<{ emitter: IEventEmitter }>;

/**
 * Adds the implementation of an event emitter to something that contains
 * a field of `emitter` with type `EventEmitter`.
 * @param Base The class to derive the mixin from.
 * @returns A class extending the base with an event emitter.
 */
export function Emits<TBase extends Eventable>(Base: TBase) {
  return class WithEvents extends Base implements IEventEmitter {
    on(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.on(eventName, listener, context);
      return this;
    }

    addListener(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.addListener(eventName, listener, context);
      return this;
    }

    once(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.once(eventName, listener, context);
      return this;
    }

    removeListener(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.removeListener(eventName, listener, context);
      return this;
    }

    off(eventName: string | symbol, listener: (...args: any) => void, context?: any): this {
      this.emitter.off(eventName, listener, context);
      return this;
    }

    removeAllListeners(event?: string | symbol): this {
      this.emitter.removeAllListeners(event);
      return this;
    }

    listeners(eventName: string | symbol): Function[] {
      return this.emitter.listeners(eventName);
    }

    emit(eventName: string | symbol, ...args: any[]): this  {
      this.emitter.emit(eventName, args);
      return this;
    }

    listenerCount(eventName: string | symbol): number {
      return this.emitter.listenerCount(eventName);
    }

    prependListener(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.prependListener(eventName, listener, context);
      return this;
    }

    prependOnceListener(eventName: string | symbol, listener: (...args: any[]) => void, context?: any): this {
      this.emitter.prependOnceListener(eventName, listener, context);
      return this;
    }

    eventNames(): (string | symbol)[] {
      return this.emitter.eventNames();
    }

    maybeReportError (error: any): this {
      this.emitter.maybeReportError(error);
      return this;
    }
  };
}
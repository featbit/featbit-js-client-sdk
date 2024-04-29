export interface IEventEmitter {
  on(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  addListener(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  once(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  off(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  removeListener(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  removeAllListeners(event?: string | symbol): this;
  listeners(event: string | symbol): Function[];
  emit(event: string | symbol, ...args: any[]): this;
  listenerCount(event: string | symbol): number;
  prependListener(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  prependOnceListener(event: string | symbol, handler: (...args: any[]) => void, context?: any): this;
  eventNames(): (string | symbol)[];
  maybeReportError(error: any): this;
}
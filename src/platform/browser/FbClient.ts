import { FbClientCore } from "../../FbClientCore.js";
import { IOptions } from "../../options/IOptions.js";
import { BasicLogger } from "../../logging/BasicLogger.js";
import { EventEmitter } from "../../utils/EventEmitter.js";
import { SafeLogger } from "../../logging/SafeLogger.js";
import { Emits } from "../../utils/Emits.js";
import { IEventEmitter } from "../../utils/IEventEmitter.js";
import { BrowserPlatform } from "./BrowserPlatform.js";
import LocalStorageStore from "./LocalStorageStore.js";
import { IPlatform } from "../IPlatform.js";
import { ILogger } from "../../logging/index.js";

/**
 * @ignore
 */
class FbClient extends FbClientCore {
  emitter: IEventEmitter;

  constructor(options: IOptions, platform: IPlatform | undefined = undefined) {
    const fallbackLogger = new BasicLogger({
      level: 'warn',
      destination: console.log
    });

    let logger;
    if (options.logger) {
      logger = new SafeLogger(options.logger, fallbackLogger)
    } else {
      logger = new BasicLogger({
        level: options.logLevel ?? "warn",
        destination: console.log
      });
    }

    const emitter = new EventEmitter(logger);

    let { store } = options;
    if (!store) {
      store = new LocalStorageStore({...options, logger});
    }

    super(
      {...options, logger, store },
      platform ?? new BrowserPlatform({...options, logger}),
      {
        onError: (err: Error) => {
          if (emitter.listenerCount('error')) {
            emitter.emit('error', err);
          }
        },
        onFailed: (err: Error) => {
          emitter.emit('failed', err);
        },
        onReady: () => {
          emitter.emit('ready');
        },
        onUpdate: (keys: string[]) => {
          emitter.emit('update', keys);
          keys.forEach((key) => emitter.emit(`update:${ key }`, key));
        },
        hasEventListeners: () =>
          emitter
            .eventNames()
            .some(
              (name) =>
                name === 'update' || (typeof name === 'string' && name.startsWith('update:')),
            ),
      },
    );

    this.emitter = emitter;
  }
}

export default Emits(FbClient);

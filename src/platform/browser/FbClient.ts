import { FbClientCore } from "../../FbClientCore";
import { IOptions } from "../../options/IOptions";
import { BasicLogger } from "../../logging/BasicLogger";
import { EventEmitter } from "../../utils/EventEmitter";
import { SafeLogger } from "../../logging/SafeLogger";
import { Emits } from "../../utils/Emits";
import { IEventEmitter } from "../../utils/IEventEmitter";
import { BrowserPlatform } from "./BrowserPlatform";
import LocalStorageStore from "./LocalStorageStore";
import { IPlatform } from "../IPlatform";

/**
 * @ignore
 */
class FbClient extends FbClientCore {
  emitter: IEventEmitter;

  constructor(options: IOptions, platform: IPlatform | undefined = undefined) {
    const fallbackLogger = new BasicLogger({
      level: 'none',
      destination: console.log
    });

    const logger = options.logger ? new SafeLogger(options.logger, fallbackLogger) : fallbackLogger;

    const emitter = new EventEmitter(logger);

    let { store } = options;
    if (!store) {
      store = new LocalStorageStore(options);
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
          emitter.emit('update', [keys]);
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
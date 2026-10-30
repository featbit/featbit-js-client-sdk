import { isHttpRecoverable, PollingError } from '../errors.js';
import { IDataSynchronizer } from './IDataSynchronizer.js';
import { ILogger } from '../logging/ILogger.js';
import Configuration from '../Configuration.js';
import { EventName, PollingErrorHandler, ProcessStreamResponse, StreamResponseEventType } from './types.js';
import Requestor from './Requestor.js';
import { httpErrorMessage } from '../utils/http.js';
import { IUser } from '../options/IUser.js';
import { StoreItemOriginEnum } from '../store/index.js';
import { onPageResume } from '../utils/onPageResume.js';
import FullSyncPolicy from './FullSyncPolicy.js';
import { copyUser } from '../utils/copyUser.js';

export default class PollingDataSynchronizer implements IDataSynchronizer {
  private stopped = false;
  private inFlight = false;
  private lastAttempt = 0;
  private removeResumeListener?: () => void;
  private readonly logger?: ILogger;
  private readonly pollingInterval: number;
  private user: IUser;
  private timeoutHandle?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private identifyResolve?: () => void;
  private identifyReject?: (error: Error) => void;

  constructor(
    config: Configuration,
    private readonly requestor: Requestor,
    private readonly getStoreTimestamp: () => number,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private readonly fullSync: FullSyncPolicy,
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    this.logger = config.logger;
    this.pollingInterval = config.pollingInterval;
    this.user = copyUser(config.user);
  }

  private poll() {
    if (this.stopped || this.inFlight) return;
    this.inFlight = true;
    this.lastAttempt = Date.now();
    const generation = this.generation;
    const user = copyUser(this.user);
    const isCurrent = () => !this.stopped && generation === this.generation;
    const startedAt = Date.now();
    let handled = false;
    const schedule = () => {
      if (!isCurrent()) return;
      this.inFlight = false;
      this.timeoutHandle = setTimeout(() => this.poll(), Math.max(this.pollingInterval - (Date.now() - startedAt), 0));
    };
    this.requestor.requestData(this.fullSync.timestamp(this.getStoreTimestamp()), user, async (err, body) => {
      if (!isCurrent() || handled) return;
      handled = true;
      if (err) {
        if (!isHttpRecoverable(err.status)) {
          const error = new PollingError(httpErrorMessage(err, 'polling request'), err.status);
          const reject = this.identifyReject;
          this.identifyReject = undefined;
          this.stop();
          reject?.(error);
          this.identifyResolve = this.identifyReject = undefined;
          this.errorHandler?.(error);
          return;
        }
        this.logger?.warn(httpErrorMessage(err, 'polling request', 'will retry'));
        schedule();
        return;
      }

      try {
        let listener = this.listeners.get('patch');
        let flags = [];
        // A 304 is represented by null by Requestor. Other responses must carry
        // a valid envelope for the user captured when this request started.
        if (body !== null) {
          const message = JSON.parse(body);
          if (message.messageType !== 'data-sync' || message.data?.userKeyId !== user.keyId ||
              !Array.isArray(message.data.featureFlags)) throw new Error('Invalid polling response');
          if (message.data.eventType === StreamResponseEventType.full) listener = this.listeners.get('put');
          else if (message.data.eventType !== StreamResponseEventType.patch) throw new Error('Invalid polling event type');
          flags = message.data.featureFlags.map((flag: any) => ({ ...flag, origin: StoreItemOriginEnum.Remote }));
        }
        if (!listener) throw new Error('Missing polling response handler');
        await listener.processJson(user.keyId, listener.deserializeData(flags), isCurrent);
        if (!isCurrent()) return;
        this.identifyResolve?.();
        this.identifyResolve = this.identifyReject = undefined;
      } catch (error) {
        if (isCurrent()) this.logger?.warn('Unable to process polling response', error);
      }
      schedule();
    });
  }

  identify(user: IUser): Promise<void> {
    this.stop();
    this.user = copyUser(user);
    this.stopped = false;
    this.watchResume();
    return new Promise((resolve, reject) => {
      this.identifyResolve = resolve;
      this.identifyReject = reject;
      this.poll();
    });
  }

  start(): void {
    this.stop();
    this.stopped = false;
    this.watchResume();
    this.poll();
  }

  private watchResume(): void {
    this.removeResumeListener = onPageResume(() => {
      if (!this.stopped && !this.inFlight && this.fullSync.due &&
          Date.now() - this.lastAttempt >= this.pollingInterval) {
        clearTimeout(this.timeoutHandle);
        this.poll();
      }
    });
  }

  close(): void {
    this.stop();
  }

  stop(): void {
    this.stopped = true;
    this.inFlight = false;
    this.removeResumeListener?.();
    this.removeResumeListener = undefined;
    ++this.generation;
    clearTimeout(this.timeoutHandle);
    this.timeoutHandle = undefined;
    this.identifyReject?.(new Error('Identify superseded or synchronizer stopped'));
    this.identifyResolve = this.identifyReject = undefined;
  }
}

import { isHttpRecoverable, PollingError } from "../errors";
import { IDataSynchronizer } from "./IDataSynchronizer";
import { ILogger } from "../logging/ILogger";
import Configuration from "../Configuration";
import { EventName, PollingErrorHandler, ProcessStreamResponse, StreamResponseEventType } from "./types";
import Requestor from "./Requestor";
import { httpErrorMessage } from "../utils/http";
import { IUser } from "../options/IUser";

export default class PollingDataSynchronizer implements IDataSynchronizer {
  private stopped = false;

  private logger?: ILogger;

  private pollingInterval: number;

  private user: IUser | undefined;

  private timeoutHandle: any;

  constructor(
    config: Configuration,
    private readonly requestor: Requestor,
    private readonly getStoreTimestamp: () => number,
    private readonly listeners: Map<EventName, ProcessStreamResponse>,
    private readonly errorHandler?: PollingErrorHandler,
  ) {
    this.logger = config.logger;
    this.pollingInterval = config.pollingInterval;
    this.user = config.user;
  }

  private poll() {
    if (this.stopped) {
      return;
    }

    const startTime = Date.now();
    this.logger?.debug('Polling for feature flag and segments updates');
    this.requestor.requestData(this.getStoreTimestamp(), this.user, (err, body) => {
      const elapsed = Date.now() - startTime;
      const sleepFor = Math.max(this.pollingInterval - elapsed, 0);

      this.logger?.debug('Elapsed: %d ms, sleeping for %d ms', elapsed, sleepFor);
      if (err) {
        const {status} = err;
        if (status && !isHttpRecoverable(status)) {
          const message = httpErrorMessage(err, 'polling request');
          this.logger?.error(message);
          this.errorHandler?.(new PollingError(message, status));
          // It is not recoverable, return and do not trigger another
          // poll.
          return;
        }
        this.logger?.warn(httpErrorMessage(err, 'polling request', 'will retry'));
      } else {
        let featureFlags = [];
        let userKeyId = this.user?.keyId!;
        let processStreamResponse: ProcessStreamResponse | undefined = this.listeners.get('patch');

        if (body) {
          const message = JSON.parse(body);
          if (message.messageType === 'data-sync') {
            switch (message.data.eventType) {
              case StreamResponseEventType.patch:
                processStreamResponse = this.listeners.get('patch');
                break;
              case StreamResponseEventType.full:
                processStreamResponse = this.listeners.get('put');
                break;
            }

            ({featureFlags, userKeyId} = message.data);
          }
        }

        const data = processStreamResponse?.deserializeData?.(featureFlags);
        processStreamResponse?.processJson?.(userKeyId, data);
      }

      // Falling through, there was some type of error and we need to trigger
      // a new poll.
      this.timeoutHandle = setTimeout(() => {
        this.poll();
      }, sleepFor);
    });
  }

  identify(user: IUser) {
    this.user = {...user};
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    this.poll();
  }

  close(): void {
    this.stop();
  }

  start(): void {
    this.poll();
  }

  stop(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    this.stopped = true;
  }
}




import { IFbClientCore } from "./IFbClientCore";
import { IPlatform } from "./platform/IPlatform";
import Configuration from "./Configuration";
import { ILogger } from "./logging/ILogger";
import ClientContext from "./options/ClientContext";
import DataSourceUpdates from "./data-sources/DataSourceUpdates";
import { createStreamListeners } from "./data-sources/createStreamListeners";
import { IEvalDetail } from "./evaluation/IEvalDetail";
import WebSocketDataSynchronizer from "./data-sync/WebSocketDataSynchronizer";
import PollingDataSynchronizer from "./data-sync/PollingDataSynchronizer";
import Requestor from "./data-sync/Requestor";
import { IDataSynchronizer } from "./data-sync/IDataSynchronizer";
import DataKinds from "./store/DataKinds";
import Evaluator from "./evaluation/Evaluator";
import { ReasonKinds } from "./evaluation/ReasonKinds";
import { ClientError, TimeoutError } from "./errors";
import Context from "./Context";
import { IConvertResult, ValueConverters } from "./utils/ValueConverters";
import { NullDataSynchronizer } from "./data-sync/NullDataSynchronizer";
import { IEventProcessor } from "./events/IEventProcessor";
import { NullEventProcessor } from "./events/NullEventProcessor";
import { DefaultEventProcessor } from "./events/DefaultEventProcessor";
import { IStore } from "./platform/IStore";
import { IOptions } from "./options/IOptions";
import { MetricEvent } from "./events/event";
import { DataSyncModeEnum } from "./data-sync/DataSyncMode";
import { IUser } from "./options/IUser";
import { UserValidator } from "./options/Validators";

enum ClientState {
  Initializing,
  Initialized,
  Failed,
}

export interface IClientCallbacks {
  onError: (err: Error) => void;
  onFailed: (err: Error) => void;
  onReady: () => void;
  // Called whenever flags change, if there are listeners.
  onUpdate: (keys: string[]) => void;
  // Method to check if event listeners have been registered.
  // If none are registered, then onUpdate will never be called.
  hasEventListeners: () => boolean;
}

export class FbClientCore implements IFbClientCore {
  private state: ClientState = ClientState.Initializing;

  private store?: IStore;

  private dataSynchronizer?: IDataSynchronizer;

  private eventProcessor?: IEventProcessor;

  private evaluator?: Evaluator;

  private initResolve?: (value: IFbClientCore | PromiseLike<IFbClientCore>) => void;

  private initReject?: (err: Error) => void;

  private rejectionReason: Error | undefined;

  private initializedPromise?: Promise<IFbClientCore>;

  private config: Configuration;

  private dataSourceUpdates?: DataSourceUpdates;

  private onError: (err: Error) => void;

  private onFailed: (err: Error) => void;

  private onReady: () => void;

  logger?: ILogger;

  constructor(
    private options: IOptions,
    private platform: IPlatform,
    callbacks: IClientCallbacks
  ) {
    this.onError = callbacks.onError;
    this.onFailed = callbacks.onFailed;
    this.onReady = callbacks.onReady;

    const {onUpdate, hasEventListeners} = callbacks;
    const config = new Configuration(options);

    if (!config.sdkKey && !config.offline) {
      throw new Error('You must configure the client with an SDK key');
    }

    if (!config.user) {
      throw new Error('You must configure the client with a user');
    }

    this.config = config;
    this.logger = config.logger;

    this.init(onUpdate, hasEventListeners);
  }

  private async init(onUpdate: (keys: string[]) => void, hasEventListeners: () => boolean) {
    const clientContext = new ClientContext(this.config.sdkKey, this.config, this.platform);
    this.store = this.config.storeFactory(clientContext);
    await this.store.identify(this.config.user);
    this.dataSourceUpdates = new DataSourceUpdates(this.store, hasEventListeners, onUpdate);
    this.evaluator = new Evaluator(this.store);

    // use bootstrap provider to populate store
    await this.config.bootstrapProvider.populate(this.config.user.keyId, this.dataSourceUpdates);

    if (this.config.offline) {
      this.eventProcessor = new NullEventProcessor();
      this.dataSynchronizer = new NullDataSynchronizer();

      this.initSuccess();
    } else {
      this.eventProcessor = new DefaultEventProcessor(clientContext);

      const listeners = createStreamListeners(this.dataSourceUpdates, this.logger, {
        put: () => this.initSuccess(),
        patch: () => this.initSuccess()
      });

      const dataSynchronizer = this.config.dataSyncMode === DataSyncModeEnum.STREAMING
        ? new WebSocketDataSynchronizer(
          this.config.sdkKey,
          this.config.user,
          clientContext,
          this.platform.webSocket,
          () => this.store!.version,
          listeners,
          this.config.webSocketPingInterval
        )
        : new PollingDataSynchronizer(
          this.config,
          new Requestor(this.config.sdkKey, this.config, this.platform.info, this.platform.requests),
          () => this.store!.version,
          listeners,
          (e) => this.dataSourceErrorHandler(e),
        );

      this.dataSynchronizer = this.config.dataSynchronizerFactory?.(
        clientContext,
        this.store,
        this.dataSourceUpdates,
        () => this.initSuccess(),
        (e) => this.dataSourceErrorHandler(e),
      ) ?? dataSynchronizer;
    }

    this.start();
  }

  async identify(user: IUser) {
    const validator = new UserValidator();
    if (!validator.is(user)) {
      validator.messages.forEach((error: string) => {
        this.logger?.warn(error);
      });

      return;
    }

    const [oldFlags, oldVersion] = this.store!.all(DataKinds.Flags);
    const oldData = {
      flags: {...oldFlags},
      version: oldVersion
    }
    this.config.user = user;
    await this.store!.identify(user);
    this.dataSynchronizer!.identify(user);
    const [ newFlags, newVersion ] = this.store!.all(DataKinds.Flags);
    const newData = {
      flags: {...newFlags},
      version: newVersion
    }
    if (Object.keys(newFlags).length === 0) {
      await this.config.bootstrapProvider.populate(user.keyId, this.dataSourceUpdates!);
    } else {
      this.dataSourceUpdates?.checkUpdates(oldData, newData);
    }
  }

  private start() {
    if (this.config.offline) {
      return;
    }

    this.dataSynchronizer!.start();
    setTimeout(() => {
      if (!this.initialized()) {
        const msg = `FbClient failed to start successfully within ${ this.config.startWaitTime } milliseconds. ` +
          'This error usually indicates a connection issue with FeatBit or an invalid sdkKey.' +
          'Please double-check your sdkKey and streamingUri/pollingUri configuration. ' +
          'We will continue to initialize the FbClient, it still have a chance to get to work ' +
          'if it\'s a temporary network issue';

        const error = new TimeoutError(msg);
        this.state = ClientState.Failed;
        this.rejectionReason = error;
        this.initReject?.(error);

        return this.logger?.warn(msg);
      }
    }, this.config.startWaitTime);
  }

  initialized(): boolean {
    return this.state === ClientState.Initialized;
  }

  waitForInitialization(): Promise<IFbClientCore> {
    // An initialization promise is only created if someone is going to use that promise.
    // If we always created an initialization promise, and there was no call waitForInitialization
    // by the time the promise was rejected, then that would result in an unhandled promise
    // rejection.

    // Initialization promise was created by a previous call to waitForInitialization.
    if (this.initializedPromise) {
      return this.initializedPromise;
    }

    // Initialization completed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a resolved promise and return it.
    if (this.state === ClientState.Initialized) {
      this.initializedPromise = Promise.resolve(this);
      return this.initializedPromise;
    }

    // Initialization failed before waitForInitialization was called, so we have completed
    // and there was no promise. So we make a rejected promise and return it.
    if (this.state === ClientState.Failed) {
      this.initializedPromise = Promise.reject(this.rejectionReason);
      return this.initializedPromise;
    }

    if (!this.initializedPromise) {
      this.initializedPromise = new Promise((resolve, reject) => {
        this.initResolve = resolve;
        this.initReject = reject;
      });
    }
    return this.initializedPromise;
  }

  boolVariation(
    key: string,
    defaultValue: boolean
  ): boolean {
    return this.evaluateCore(key, defaultValue, ValueConverters.bool).value!;
  }

  boolVariationDetail(
    key: string,
    defaultValue: boolean
  ): IEvalDetail<boolean> {
    return this.evaluateCore(key, defaultValue, ValueConverters.bool);
  }

  jsonVariation(key: string, defaultValue: any): any {
    return this.evaluateCore(key, defaultValue, ValueConverters.json).value!;
  }

  jsonVariationDetail(key: string, defaultValue: any): IEvalDetail<any> {
    return this.evaluateCore(key, defaultValue, ValueConverters.json);
  }

  numberVariation(key: string, defaultValue: number): number {
    return this.evaluateCore(key, defaultValue, ValueConverters.number).value!;
  }

  numberVariationDetail(key: string, defaultValue: number): IEvalDetail<number> {
    return this.evaluateCore(key, defaultValue, ValueConverters.number);
  }

  stringVariation(key: string, defaultValue: string): string {
    return this.evaluateCore(key, defaultValue, ValueConverters.string).value!;
  }

  stringVariationDetail(key: string, defaultValue: string): IEvalDetail<string> {
    return this.evaluateCore(key, defaultValue, ValueConverters.string);
  }

  variation(key: string, defaultValue: string): string {
    return this.evaluateCore(key, defaultValue, ValueConverters.string).value!;
  }

  variationDetail(key: string, defaultValue: string): IEvalDetail<string> {
    return this.evaluateCore(key, defaultValue, ValueConverters.string);
  }

  getAllVariations(): Promise<IEvalDetail<string>[]> {
    const context = Context.fromUser(this.config.user);
    if (!context.valid) {
      const error = new ClientError(
        `${ context.message ?? 'User not valid;' } returning default value.`,
      );
      this.onError(error);

      return Promise.resolve([]);
    }

    const [flags, _] = this.store!.all(DataKinds.Flags);
    const result = Object.keys(flags).map(flagKey => {
      const evalResult = this.evaluator!.evaluate(flagKey);
      return {flagKey, kind: evalResult.kind, reason: evalResult.reason, value: evalResult.value?.variation};
    });

    return Promise.resolve(result);
  }

  async close(): Promise<void> {
    await this.eventProcessor!.close();
    this.dataSynchronizer?.close();
    this.store!.close();
  }

  track(eventName: string, metricValue?: number | undefined): void {
    const metricEvent = new MetricEvent(this.config.user, eventName, this.platform.info.appType, metricValue ?? 1);
    this.eventProcessor!.record(metricEvent);
    return;
  }

  async flush(callback?: (res: boolean) => void): Promise<boolean> {
    try {
      await this.eventProcessor!.flush();
      callback?.(true);
      return true;
    } catch (err) {
      callback?.(false);
      return false;
    }
  }

  evaluateCore<TValue>(
    flagKey: string,
    defaultValue: TValue,
    typeConverter: (value: string) => IConvertResult<TValue>
  ): IEvalDetail<TValue> {
    const context = Context.fromUser(this.config.user);
    if (!context.valid) {
      const error = new ClientError(
        `${ context.message ?? 'User not valid;' } returning default value.`,
      );
      this.onError(error);

      return {flagKey, kind: ReasonKinds.Error, reason: error.message, value: defaultValue};
    }

    const evalResult = this.evaluator!.evaluate(flagKey);

    if (evalResult.kind === ReasonKinds.FlagNotFound) {
      // flag not found, return default value
      const error = new ClientError(evalResult.reason!);
      this.onError(error);

      return {flagKey, kind: evalResult.kind, reason: evalResult.reason, value: defaultValue};
    }

    if (!this.initialized()) {
      this.logger?.warn(
        'Variation called before FeatBit client initialization completed (did you wait for the' +
        "'ready' event?)",
      );
    } else {
      // send event
      this.eventProcessor!.record(evalResult.toEvalEvent(this.config.user));
    }

    const {isSucceeded, value} = typeConverter(evalResult.value?.variation!);
    return isSucceeded
      ? {flagKey, kind: evalResult.kind, reason: evalResult.reason, value}
      : {flagKey, kind: ReasonKinds.WrongType, reason: 'type mismatch', value: defaultValue};
  }

  private dataSourceErrorHandler(e: any) {
    const error =
      e.code === 401 ? new Error('Authentication failed. Double check your SDK key.') : e;

    this.onError(error);
    this.onFailed(error);

    if (!this.initialized()) {
      this.state = ClientState.Failed;
      this.rejectionReason = error;
      this.initReject?.(error);
    }
  }

  private initSuccess() {
    if (!this.initialized()) {
      this.state = ClientState.Initialized;
      this.logger?.info('FbClient started successfully.');
      this.initResolve?.(this);
      this.onReady();
    }
  }
}

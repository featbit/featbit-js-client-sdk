import { IOptions } from "./options/IOptions";
import { ILogger } from "./logging/ILogger";
import { IValidatedOptions } from "./options/IValidatedOptions";
import { NumberWithMinimum, TypeValidator, TypeValidators, UserValidator } from "./options/Validators";
import OptionMessages from "./options/OptionMessages";
import { IStore } from "./platform/IStore";
import { IClientContext } from "./options/IClientContext";
import { IDataSynchronizer } from "./data-sync/IDataSynchronizer";
import { IDataSourceUpdates } from "./store/IDataSourceUpdates";
import InMemoryStore from "./store/InMemoryStore";
import { VoidFunction } from "./utils/VoidFunction";
import { isNullOrUndefined } from "./utils/isNullOrUndefined";
import { canonicalizeUri } from "./utils/canonicalizeUri";
import { IBootstrapProvider } from "./bootstrap/IBootstrapProvider";
import { NullBootstrapProvider } from "./bootstrap/NullBootstrapProvider";
import { EmptyString } from "./constants";
import { DataSyncModeEnum } from "./data-sync/DataSyncMode";
import { IUser } from "./options/IUser";
import { JsonBootstrapProvider } from "./bootstrap";

// Once things are internal to the implementation of the SDK we can depend on
// types. Calls to the SDK could contain anything without any regard to typing.
// So, data we take from external sources must be normalized into something
// that can be trusted.

/**
 * These perform cursory validations. Complex objects are implemented with classes
 * and these should allow for conditional construction.
 */
const validations: Record<string, TypeValidator> = {
  startWaitTime: TypeValidators.Number,
  sdkKey: TypeValidators.String,
  pollingUri: TypeValidators.String,
  streamingUri: TypeValidators.String,
  eventsUri: TypeValidators.String,
  webSocketPingInterval: TypeValidators.Number,
  logger: TypeValidators.Object,
  store: TypeValidators.ObjectOrFactory,
  dataSynchronizer: TypeValidators.ObjectOrFactory,
  flushInterval: TypeValidators.Number,
  maxEventsInQueue: TypeValidators.Number,
  pollingInterval: TypeValidators.Number,
  offline: TypeValidators.Boolean,
  dataSyncMode: TypeValidators.String,
  bootstrap: TypeValidators.Bootstrap,
  user: TypeValidators.User
};

/**
 * @internal
 */
export const defaultValues: IValidatedOptions = {
  startWaitTime: 5000,
  sdkKey: '',
  pollingUri: '',
  streamingUri: '',
  eventsUri: '',
  dataSyncMode: DataSyncModeEnum.STREAMING,
  sendEvents: true,
  webSocketPingInterval: 18 * 1000,
  flushInterval: 2000,
  maxEventsInQueue: 10000,
  pollingInterval: 30000,
  offline: false,
  store: (options: IOptions) => new InMemoryStore(),
  bootstrap: undefined,
  user: undefined,
};

function validateTypesAndNames(options: IOptions): {
  errors: string[];
  validatedOptions: IValidatedOptions;
} {
  let errors: string[] = [];
  const validatedOptions: IValidatedOptions = {...defaultValues};
  Object.keys(options).forEach((optionName) => {
    // We need to tell typescript it doesn't actually know what options are.
    // If we don't then it complains we are doing crazy things with it.
    const optionValue = (options as unknown as any)[optionName];
    const validator = validations[optionName];
    if (validator) {
      if (!validator.is(optionValue)) {
        if (validator.getType() === 'boolean') {
          errors.push(OptionMessages.wrongOptionTypeBoolean(optionName, typeof optionValue));
          validatedOptions[optionName] = !!optionValue;
        } else if (
          validator instanceof NumberWithMinimum &&
          TypeValidators.Number.is(optionValue)
        ) {
          const {min} = validator as NumberWithMinimum;
          errors.push(OptionMessages.optionBelowMinimum(optionName, optionValue, min));
          validatedOptions[optionName] = min;
        } else if (validator instanceof UserValidator) {
          errors = [...errors, ...validator.messages];
          validatedOptions[optionName] = defaultValues[optionName];
        } else {
          errors.push(
            OptionMessages.wrongOptionType(optionName, validator.getType(), typeof optionValue),
          );
          validatedOptions[optionName] = defaultValues[optionName];
        }
      } else {
        validatedOptions[optionName] = optionValue;
      }
    } else {
      options.logger?.warn(OptionMessages.unknownOption(optionName));
    }
  });
  return {errors, validatedOptions};
}

function validateEndpoints(options: IOptions, validatedOptions: IValidatedOptions) {
  const {streamingUri, pollingUri, eventsUri} = options;
  const streamingUriMissing = isNullOrUndefined(streamingUri) || streamingUri === EmptyString;
  const pollingUriMissing = isNullOrUndefined(pollingUri) || pollingUri === EmptyString;
  const eventsUriMissing = isNullOrUndefined(eventsUri) || eventsUri === EmptyString;

  if (!validatedOptions.offline && (eventsUriMissing || (streamingUriMissing && pollingUriMissing))) {
    if (eventsUriMissing) {
      validatedOptions.logger?.error(OptionMessages.partialEndpoint('eventsUri'));
    }

    if (validatedOptions.dataSyncMode === DataSyncModeEnum.STREAMING && streamingUriMissing) {
      validatedOptions.logger?.error(OptionMessages.partialEndpoint('streamingUri'));
    }

    if (validatedOptions.dataSyncMode === DataSyncModeEnum.POLLING && pollingUriMissing) {
      validatedOptions.logger?.error(OptionMessages.partialEndpoint('pollingUri'));
    }
  }
}

export default class Configuration {
  public readonly startWaitTime: number;

  public readonly sdkKey: string;

  public readonly streamingUri: string;

  public readonly pollingUri: string;

  public readonly eventsUri: string;

  public readonly webSocketPingInterval: number;

  public readonly logger?: ILogger;

  public readonly flushInterval: number;

  public readonly maxEventsInQueue: number;

  public readonly pollingInterval: number;

  public readonly offline: boolean;

  public readonly dataSyncMode: DataSyncModeEnum;

  public readonly bootstrapProvider: IBootstrapProvider = new NullBootstrapProvider();

  public user: IUser;

  public readonly storeFactory: (clientContext: IClientContext) => IStore;

  public readonly dataSynchronizerFactory?: (
    clientContext: IClientContext,
    store: IStore,
    dataSourceUpdates: IDataSourceUpdates,
    initSuccessHandler: VoidFunction,
    errorHandler?: (e: Error) => void,
  ) => IDataSynchronizer;

  constructor(options: IOptions = {}) {
    // The default will handle undefined, but not null.
    // Because we can be called from JS we need to be extra defensive.
    options = options || {};
    // If there isn't a valid logger from the platform, then logs would go nowhere.
    this.logger = options.logger;

    const {errors, validatedOptions} = validateTypesAndNames(options);
    errors.forEach((error) => {
      this.logger?.warn(error);
    });

    this.user = options.user!;

    validateEndpoints(options, validatedOptions);
    this.streamingUri = `${ canonicalizeUri(validatedOptions.streamingUri) }/streaming`;
    this.pollingUri = `${ canonicalizeUri(validatedOptions.pollingUri) }/api/public/sdk/client/latest-all`;
    this.eventsUri = `${ canonicalizeUri(validatedOptions.eventsUri) }/api/public/insight/track`;

    this.startWaitTime = validatedOptions.startWaitTime;

    this.sdkKey = validatedOptions.sdkKey;
    this.webSocketPingInterval = validatedOptions.webSocketPingInterval!;

    this.flushInterval = validatedOptions.flushInterval;
    this.maxEventsInQueue = validatedOptions.maxEventsInQueue;
    this.pollingInterval = validatedOptions.pollingInterval;

    this.offline = validatedOptions.offline;
    if (validatedOptions.bootstrap && validatedOptions.bootstrap.length > 0) {
      try {
        this.bootstrapProvider = new JsonBootstrapProvider(validatedOptions.bootstrap);
      } catch (_) {
        this.logger?.error('Failed to parse bootstrap JSON, use NullBootstrapProvider.');
      }
    }

    if (this.offline) {
      this.logger?.info('Offline mode enabled. No data synchronization with the FeatBit server will occur.');
    }

    this.dataSyncMode = validatedOptions.dataSyncMode;

    if (TypeValidators.Function.is(validatedOptions.dataSynchronizer)) {
      // @ts-ignore
      this.dataSynchronizerFactory = validatedOptions.dataSynchronizer;
    } else {
      // The processor is already created, just have the method return it.
      // @ts-ignore
      this.dataSynchronizerFactory = () => validatedOptions.dataSynchronizer;
    }

    if (TypeValidators.Function.is(validatedOptions.store)) {
      // @ts-ignore
      this.storeFactory = validatedOptions.store;
    } else {
      // The store is already created, just have the method return it.
      // @ts-ignore
      this.storeFactory = () => validatedOptions.store;
    }
  }
}
import { IFbClient } from "./IFbClient";
import { IOptions } from "./options/IOptions";
import FbClient from "./platform/browser/FbClient";
import { IDataSynchronizer } from "./data-sync/IDataSynchronizer";
import { IClientContext } from "./options/IClientContext";
import { IDataSourceUpdates } from "./store/IDataSourceUpdates";
import { VoidFunction } from "./utils/VoidFunction";
import { ILogger } from "./logging/ILogger";
import { DataSyncModeEnum } from "./data-sync/DataSyncMode";
import { IUser } from "./options/IUser";
import { IFlagBase } from "./evaluation";
import { IPlatform } from "./platform";

/**
 * Creates an instance of the FeatBit client.
 *
 * Applications should instantiate a single instance for the lifetime of the application.
 * The client will begin attempting to connect to FeatBit as soon as it is created. To
 * determine when it is ready to use, call {@link IFbClient.waitForInitialization}, or register an
 * event listener for the `"ready"` event using {@link IFbClient.on}.
 *
 * **Important:** Do **not** try to instantiate `FbClient` with its constructor
 * (`new FbClientNode()`); the SDK does not currently support
 * this.
 *
 * @return
 *   The new {@link IFbClient} instance.
 */
export class FbClientBuilder {
  private _options: IOptions;
  private _platform: IPlatform | undefined;

  constructor(options?: IOptions) {
    this._options = options ?? {};
  }

  /**
   * Creates a new instance of the FeatBit client.
   */
  build(): IFbClient {
    return new FbClient(this._options, this._platform);
  }

  platform(platform: IPlatform | undefined): FbClientBuilder {
    this._platform = platform;
    return this;
  }

  /**
   * Refer to {@link IOptions.startWaitTime}.
   */
  startWaitTime(startWaitTime: number): FbClientBuilder {
    this._options.startWaitTime = startWaitTime;
    return this;
  }

  /**
   * Refer to {@link IOptions.sdkKey}.
   */
  sdkKey(sdkKey: string): FbClientBuilder {
    this._options.sdkKey = sdkKey;
    return this;
  }

  /**
   * Refer to {@link IOptions.user}.
   */
  user(user: IUser): FbClientBuilder {
    this._options.user = user;
    return this;
  }

  /**
   * Refer to {@link IOptions.streamingUri}.
   */
  streamingUri(streamingUri: string): FbClientBuilder {
    this._options.streamingUri = streamingUri;
    return this;
  }

  /**
   * Refer to {@link IOptions.pollingUri}.
   */
  pollingUri(pollingUri: string): FbClientBuilder {
    this._options.pollingUri = pollingUri;
    return this;
  }

  /**
   * Refer to {@link IOptions.eventsUri}.
   */
  eventsUri(eventsUri: string): FbClientBuilder {
    this._options.eventsUri = eventsUri;
    return this;
  }

  /**
   * Refer to {@link IOptions.dataSyncMode}.
   */
  dataSyncMode(mode: DataSyncModeEnum): FbClientBuilder {
    this._options.dataSyncMode = mode;
    return this;
  }

  /**
   * Refer to {@link IOptions.pollingInterval}.
   */
  pollingInterval(pollingInterval: number): FbClientBuilder {
    this._options.pollingInterval = pollingInterval;
    return this;
  }

  /**
   * Refer to {@link IOptions.flushInterval}.
   */
  flushInterval(flushInterval: number): FbClientBuilder {
    this._options.flushInterval = flushInterval;
    return this;
  }

  /**
   * Refer to {@link IOptions.maxEventsInQueue}.
   */
  maxEventsInQueue(maxEventsInQueue: number): FbClientBuilder {
    this._options.maxEventsInQueue = maxEventsInQueue;
    return this;
  }

  /**
   * Refer to {@link IOptions.logger}.
   */
  logger(logger: ILogger): FbClientBuilder {
    this._options.logger = logger;
    return this;
  }

  /**
   * Refer to {@link IOptions.offline}.
   */
  offline(offline: boolean): FbClientBuilder {
    this._options.offline = offline;
    return this;
  }

  /**
   * Use the JsonBootstrapProvider.
   */
  bootstrap(flags: IFlagBase[]): FbClientBuilder {
    this._options.bootstrap = flags;
    return this;
  }

  /**
   * Refer to {@link IOptions.dataSynchronizer}.
   */
  dataSynchronizer(
    dataSynchronizer: IDataSynchronizer |
    ((
      clientContext: IClientContext,
      dataSourceUpdates: IDataSourceUpdates,
      initSuccessHandler: VoidFunction,
      errorHandler?: (e: Error) => void,
    ) => IDataSynchronizer)
  ): FbClientBuilder {
    this._options.dataSynchronizer = dataSynchronizer;
    return this;
  }
}
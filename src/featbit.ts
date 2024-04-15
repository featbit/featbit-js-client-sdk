import {eventHub} from "./events";
import {logger} from "./logger";
import store from "./store";
import {networkService} from "./network.service";
import {
  FeatureFlagValue,
  ICustomEvent,
  IFeatureFlag,
  IFeatureFlagBase,
  IFeatureFlagSet,
  IFeatureFlagVariationBuffer,
  IInsight,
  InsightType,
  IOption,
  IStreamResponse,
  IUser,
  StreamResponseEventType,
  VariationDataType
} from "./types";
import {
  generateorGetGuid,
  isNullOrUndefinedOrWhiteSpace,
  parseVariation,
  serializeUser,
  validateOption,
  validateUser
} from "./utils";
import {Queue} from "./queue";
import {
  currentUserStorageKey,
  featureFlagEvaluatedBufferTopic,
  featureFlagEvaluatedTopic,
  insightsFlushTopic,
  insightsTopic,
  websocketReconnectTopic
} from "./constants";


function createOrGetAnonymousUser(): IUser {
  const sessionId = generateorGetGuid();

  return {
    name: sessionId,
    keyId: sessionId
  };
}

function mapFeatureFlagsToFeatureFlagBaseList(featureFlags: { [key: string]: IFeatureFlag }): IFeatureFlagBase[] {
  return Object.keys(featureFlags).map((cur) => {
    const { id, variation } = featureFlags[cur];
    const variationType = featureFlags[cur].variationType || VariationDataType.string;
    return { id, variation: parseVariation(variationType, variation), variationType };
  });
}

export class FB {
  private _readyEventEmitted: boolean = false;
  private _readyPromise: Promise<IFeatureFlagBase[]>;

  private _insightsQueue: Queue<IInsight> = new Queue<IInsight>(1, insightsFlushTopic);
  private _featureFlagEvaluationBuffer: Queue<IFeatureFlagVariationBuffer> = new Queue<IFeatureFlagVariationBuffer>();
  private _option: IOption = {
    secret: '',
    api: '',
    streamingUri: '',
    eventsUri: '',
    enableDataSync: true,
    appType: 'javascript'
  };

  constructor() {
    this._readyPromise = new Promise<IFeatureFlagBase[]>((resolve, reject) => {
      this.on('ready', () => {
        const featureFlags = store.getFeatureFlags();
        resolve(mapFeatureFlagsToFeatureFlagBaseList(featureFlags));
        if (this._option.enableDataSync){
          const buffered = this._featureFlagEvaluationBuffer.flush().map(f => {
            const featureFlag = featureFlags[f.id];
            if (!featureFlag) {
              logger.log(`Called unexisting feature flag: ${f.id}`);
              return null;
            }
            
            const variation = featureFlag.variationOptions.find(o => o.value === f.variationValue);
            if (!variation) {
              logger.log(`Sent buffered insight for feature flag: ${f.id} with unexisting default variation: ${f.variationValue}`);
            } else {
              logger.logDebug(`Sent buffered insight for feature flag: ${f.id} with variation: ${variation.value}`);
            }

            return {
              insightType: InsightType.featureFlagUsage,
              id: featureFlag.id,
              timestamp: f.timestamp,
              sendToExperiment: featureFlag.sendToExperiment,
              variation: variation || { id: -1, value: f.variationValue }
            }
          });

          networkService.sendInsights(buffered.filter(x => !!x));
        }
      });
    });

    // reconnect to websocket
    eventHub.subscribe(websocketReconnectTopic, async () => {
      try {
        logger.logDebug('reconnecting');
        await this.dataSync();
        if (!this._readyEventEmitted) {
          this._readyEventEmitted = true;
          eventHub.emit('ready', mapFeatureFlagsToFeatureFlagBaseList(store.getFeatureFlags()));
        }
      }catch(err) {
        logger.log('data sync error', err);
      }
    });

    eventHub.subscribe(featureFlagEvaluatedBufferTopic, (data: IFeatureFlagVariationBuffer) => {
      this._featureFlagEvaluationBuffer.add(data);
    });

    // track feature flag usage data
    eventHub.subscribe(insightsFlushTopic, () => {
      if (this._option.enableDataSync){
        networkService.sendInsights(this._insightsQueue.flush());
      }
    });

    eventHub.subscribe(featureFlagEvaluatedTopic, (data: IInsight) => {
      this._insightsQueue.add(data);
    });

    eventHub.subscribe(insightsTopic, (data: IInsight) => {
      this._insightsQueue.add(data);
    });
  }

  on(name: string, cb: Function) {
    eventHub.subscribe(name, cb);
  }

  waitUntilReady(): Promise<IFeatureFlagBase[]> {
    return this._readyPromise;
  }

  async init(option: IOption) {
    const validateOptionResult = validateOption({...this._option, ...option});
    if (validateOptionResult !== null) {
      logger.log(validateOptionResult);
      return;
    }

    this._option = {
      ...this._option,
      ...option,
      ...{
        api: (option.api || this._option.api)?.replace(/\/$/, '')
      }
    };

    if (isNullOrUndefinedOrWhiteSpace(this._option.streamingUri)) {
      this._option.streamingUri = this._option.api?.replace(/^http/, 'ws');
    }

    if (isNullOrUndefinedOrWhiteSpace(this._option.eventsUri)) {
      this._option.eventsUri = this._option.api;
    }

    if (this._option.enableDataSync) {
      networkService.init(this._option.streamingUri!, this._option.eventsUri!, this._option.secret, this._option.appType!);
    }
    
    await this.identify(option.user || createOrGetAnonymousUser());
  }

  async identify(user: IUser): Promise<void> {
    const validateUserResult = validateUser(user);
    if (validateUserResult !== null) {
      logger.log(validateUserResult);
      return;
    }

    user.customizedProperties = user.customizedProperties?.map(p => ({name: p.name, value: `${p.value}`}));

    const isUserChanged = serializeUser(user) !== localStorage.getItem(currentUserStorageKey);
    this._option.user = Object.assign({}, user);
    localStorage.setItem(currentUserStorageKey, serializeUser(this._option.user));

    store.userId = this._option.user.keyId;
    networkService.identify(this._option.user, isUserChanged);

    await this.bootstrap(this._option.bootstrap, isUserChanged);
  }

  async logout(): Promise<IUser> {
    const anonymousUser = createOrGetAnonymousUser();
    await this.identify(anonymousUser);
    return anonymousUser;
  }

  /**
   * bootstrap with predefined feature flags.
   * @param {array} featureFlags the predefined feature flags.
   * @param {boolean} forceFullFetch if a forced full fetch should be made.
   * @return {Promise<void>} nothing.
   */
  async bootstrap(featureFlags?: IFeatureFlag[], forceFullFetch?: boolean): Promise<void> {
    featureFlags = featureFlags || this._option.bootstrap;
    if (featureFlags && featureFlags.length > 0) {
      const data = {
        featureFlags: featureFlags.reduce((res, curr) => {
          const { id, variation, timestamp, variationOptions, sendToExperiment, variationType } = curr;
          res[id] = { id, variation, timestamp, variationOptions: variationOptions || [{id: 1, value: variation}], sendToExperiment, variationType: variationType || VariationDataType.string };

          return res;
        }, {} as { [key: string]: IFeatureFlag })
      };

      store.setFullData(data);
      logger.logDebug('bootstrapped with full data');
    }

    if (this._option.enableDataSync) {
      // start data sync
      try {
        await this.dataSync(forceFullFetch);
      }catch(err) {
        logger.log('data sync error', err);
      }
    }

    if (!this._readyEventEmitted) {
      this._readyEventEmitted = true;
      eventHub.emit('ready', mapFeatureFlagsToFeatureFlagBaseList(store.getFeatureFlags()));
    }
  }

  private async dataSync(forceFullFetch?: boolean): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      const timestamp = forceFullFetch ? 0 : Math.max(...Object.values(store.getFeatureFlags()).map(ff => ff.timestamp), 0);

      networkService.createConnection(timestamp, (message: IStreamResponse) => {
        if (message && message.userKeyId === this._option.user?.keyId) {
          const { featureFlags } = message;

          switch (message.eventType) {
            case StreamResponseEventType.full: // full data
            case StreamResponseEventType.patch: // partial data
              const data = {
                featureFlags: featureFlags.reduce((res, curr) => {
                  const { id, variation, timestamp, variationOptions, sendToExperiment, variationType } = curr;
                  res[id] = { id, variation, timestamp, variationOptions, sendToExperiment, variationType: variationType || VariationDataType.string };

                  return res;
                }, {} as { [key: string]: IFeatureFlag })
              };

              if (message.eventType === StreamResponseEventType.full) {
                store.setFullData(data);
                logger.logDebug('synchonized with full data');
              } else {
                store.updateBulkFromRemote(data);
                logger.logDebug('synchonized with partial data');
              }

              break;
            default:
              logger.logDebug('invalid stream event type: ' + message.eventType);
              break;
          }
        }

        resolve();
      });
    });
  }

  variation(key: string, defaultResult: FeatureFlagValue): FeatureFlagValue {
    const variation = variationWithInsightBuffer(key, defaultResult);
    return variation === undefined ? defaultResult : variation;
  }

  /**
   * deprecated, you should use variation method directly
   */
  boolVariation(key: string, defaultResult: boolean): boolean {
    const variation = variationWithInsightBuffer(key, defaultResult);
    return variation === undefined ? defaultResult : variation?.toLocaleLowerCase() === 'true';
  }

  getUser(): IUser {
    return { ...this._option.user! };
  }

  sendCustomEvent(data: ICustomEvent[]): void {
    (data || []).forEach(d => this._insightsQueue.add({
      insightType: InsightType.customEvent,
      timestamp: Date.now(),
      type: 'CustomEvent',
      ...d
    }))
  }

  sendFeatureFlagInsight(key: string, variation: string) {
    this.variation(key, variation);
  }

  getAllFeatureFlags(): IFeatureFlagSet {
    const flags = store.getFeatureFlags();

    return Object.values(flags).reduce((acc, curr) => {
      acc[curr.id] = parseVariation(curr.variationType, curr.variation);
      return acc;
    }, {});
  }
}

const variationWithInsightBuffer = (key: string, defaultResult: string | boolean) => {
  const variation = store.getVariation(key);
  if (variation === undefined) {
    eventHub.emit(featureFlagEvaluatedBufferTopic, {
      id: key,
      timestamp: Date.now(),
      variationValue: `${defaultResult}`
    } as IFeatureFlagVariationBuffer);
  }

  return variation;
}

export default new FB();


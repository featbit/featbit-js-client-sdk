import { IEvalDetail } from "./evaluation/IEvalDetail";
import { IConvertResult } from "./utils/ValueConverters";
import { IUser } from "./options";

/**
 * The FeatBit SDK client object.
 *
 * Create this object with {@link FbClientBuilder}. Applications should configure the client at startup time
 * and continue to use it throughout the lifetime of the application, rather than creating instances
 * on the fly.
 *
 */
export interface IFbClientCore {
  /**
   * Set the current user of the client.
   *
   * @param user
   *   The current user. The actual type of this parameter is
   *   {@link IUser}.
   */
  identify(user: IUser): void;

  /**
   * Indicates whether the client is ready to be used.
   *
   * @returns true if the client is ready to be used, false otherwise.
   */
  initialized(): boolean;

  /**
   * Wait until the client is initialized. The promise resolves when the client has finished initializing successfully.
   * If the client fails to initialize, the promise will be rejected.
   *
   * @returns A promise.
   */
  waitForInitialization(): Promise<IFbClientCore>;

  /**
   * Calculates the boolean value of a feature flag for a given user.
   *
   * If the flag variation does not have a boolean value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns the variation for the given user, or {@link defaultValue} if the flag cannot be evaluated
   */
  boolVariation(
    key: string,
    defaultValue: boolean
  ): boolean;

  /**
   * Calculates the boolean value of a feature flag for a given user, and returns an object that
   * describes the way the value was determined.
   *
   * If the flag variation does not have a boolean value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  boolVariationDetail(
    key: string,
    defaultValue: boolean
  ): IEvalDetail<boolean>;

  /**
   * Calculates the number value of a feature flag for a given user.
   *
   * If the flag variation does not have a number value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns the variation for the given user, or {@link defaultValue} if the flag cannot be evaluated
   */
  numberVariation(
    key: string,
    defaultValue: number
  ): number;

  /**
   * Calculates the number value of a feature flag for a given user, and returns an object that
   * describes the way the value was determined.
   *
   * If the flag variation does not have a number value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  numberVariationDetail(
    key: string,
    defaultValue: number
  ): IEvalDetail<number>;

  /**
   * Calculates the string value of a feature flag for a given user.
   *
   * If the flag variation does not have a string value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns the variation for the given user, or {@link defaultValue} if the flag cannot be evaluated
   */
  stringVariation(
    key: string,
    defaultValue: string
  ): string;

  /**
   * Calculates the string value of a feature flag for a given user, and returns an object that
   * describes the way the value was determined.
   *
   * If the flag variation does not have a string value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  stringVariationDetail(
    key: string,
    defaultValue: string
  ): IEvalDetail<string>;

  /**
   * Calculates the JSON value of a feature flag for a given user.
   *
   * If the flag variation does not have a JSON value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns the variation for the given user, or {@link defaultValue} if the flag cannot be evaluated
   */
  jsonVariation(
    key: string,
    defaultValue: any
  ): any;

  /**
   * Calculates the JSON value of a feature flag for a given user, and returns an object that
   * describes the way the value was determined.
   *
   * If the flag variation does not have a JSON value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  jsonVariationDetail(
    key: string,
    defaultValue: any
  ): IEvalDetail<any>;

  /**
   * Calculates the string value of a feature flag for a given user.
   *
   * If the flag variation does not have a string value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns the variation for the given user, or {@link defaultValue} if the flag cannot be evaluated
   */
  variation(
    key: string,
    defaultValue: string
  ): string;

  /**
   * Calculates the string value of a feature flag for a given user, and returns an object that
   * describes the way the value was determined.
   *
   * If the flag variation does not have a string value, {@link defaultValue} is returned.
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param key
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  variationDetail(
    key: string,
    defaultValue: string
  ): IEvalDetail<string>;

  /**
   * This method is exposed only for testing purpose, please DO NOT USE IT
   *
   * Calculates the value of a feature flag for a given user, and returns a {@link IEvalDetail} object that
   * describes the way the value was determined.
   *
   * If an error makes it impossible to evaluate the flag (for instance, the feature flag key
   * does not match any existing flag), {@link defaultValue} is returned.
   *
   * @param flagKey
   *  The unique key of the feature flag.
   * @param defaultValue
   *  The default value to return if the flag cannot be evaluated.
   * @param typeConverter
   *  the function to convert result.
   *
   *  @returns {@link IEvalDetail} object describing the way the value was determined.
   */
  evaluateCore<TValue>(
    flagKey: string,
    defaultValue: TValue,
    typeConverter: (value: string) => IConvertResult<TValue>
  ): IEvalDetail<TValue>;

  /**
   * Returns the variation with  of all feature flags for a given user, and returns an object that
   * describes the way the value was determined for each flag.
   *
   *  @returns A list of {@link IEvalDetail} objects describing the way the values were determined.
   */
  getAllVariations(): Promise<IEvalDetail<string>[]>;

  /**
   * Shuts down the client and releases any resources it is using.
   *
   * @returns A promise that resolves when the client has been shut down.
   */
  close(): Promise<void>;

  /**
   * Tracks that an application-defined event occurred, and provides an additional numeric value for custom metrics.
   *
   * @param eventName
   *  the name of the event.
   * @param metricValue
   *  a numeric value used by the FeatBit experimentation feature in custom numeric metrics, the default value is 1 if not provided.
   */
  track(eventName: string, metricValue?: number | undefined): void

  /**
   * Tells the client that all pending events (if any) should be delivered as soon as possible.
   *
   * @param callback
   *  Will be called when the flush operation is complete. If the flush fails, the callback will be called with false.
   *
   * @returns A promise that resolves when the client has been shut down.
   */
  flush(callback?: (res: boolean) => void): Promise<boolean>;
}
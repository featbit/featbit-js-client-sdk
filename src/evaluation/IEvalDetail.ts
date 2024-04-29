import { ReasonKinds } from "./ReasonKinds";

export interface IEvalDetail<TValue> {
  /**
   * The unique key of the feature flag.
   */
  flagKey: string;

  /**
   * An enum indicating the category of the reason. See {@link ReasonKinds}
   */
  kind: ReasonKinds;

  /**
   * The result of the flag evaluation. This will be either one of the flag's variations or
   * the default value that was passed to `FbClient.variationDetail`.
   */
  value?: TValue;

  /**
   * A string describing the main factor that influenced the flag evaluation value.
   */
  reason?: string;
}
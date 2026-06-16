import { IFlag } from "./data/IFlag";
import EvalResult from "./EvalResult";
import { IStore } from "../platform/IStore";
import DataKinds from "../store/DataKinds";
import { ILogger } from "../logging";

/**
 * @internal
 */
export default class Evaluator {
  constructor(private store: IStore, private logger?: ILogger) {
  }

  /**
   * Evaluate the given flag against the given context.
   * @param flagKey The key of the feature flag.
   */
  evaluate(
    flagKey: string,
  ): EvalResult {
    const flag = this.store.get(DataKinds.Flags, flagKey) as unknown as IFlag;
    if (!flag) {
      return EvalResult.flagNotFound(flagKey);
    }

    if (flag.matchReason === 'flag archived') {
      this.logger?.warn(`Evaluating an archived flag: ${flagKey}`)
      return EvalResult.flagArchived(flagKey);
    }

    return EvalResult.matched(flag);
  }
}
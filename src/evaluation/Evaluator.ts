import { IFlag } from "./data/IFlag.js";
import EvalResult from "./EvalResult.js";
import { IStore } from "../platform/IStore.js";
import DataKinds from "../store/DataKinds.js";
import { ILogger } from "../logging/index.js";

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
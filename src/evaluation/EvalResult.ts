import { ReasonKinds } from "./ReasonKinds.js";
import { IFlag } from "./data/IFlag.js";
import { EvalEvent } from "../events/event.js";
import { IUser } from "../options/IUser.js";

/**
 * A class which encapsulates the result of an evaluation. It allows for differentiating between
 * successful and error result types.
 *
 * @internal
 */
export default class EvalResult {
  protected constructor(
    public kind: ReasonKinds,
    public value: IFlag | null,
    public reason?: string,
  ) {
  }

  static flagArchived(flagKey: string): EvalResult {
    return new EvalResult(ReasonKinds.FlagNotFound, null, `flag archived: ${ flagKey }`);
  }

  static flagNotFound(flagKey: string) {
    return new EvalResult(ReasonKinds.FlagNotFound, null, `flag not found: ${ flagKey }`);
  }

  static matched(val: IFlag) {
    return new EvalResult(ReasonKinds.Match, val, val.matchReason);
  }

  toEvalEvent(user: IUser): EvalEvent | null {
    if (this.kind !== ReasonKinds.Match) {
      return null;
    }

    const targetedVariation = this.value?.variations.find(v => v.value === this.value?.variation);
    return new EvalEvent(user, this.value?.id!, targetedVariation!, this.value?.sendToExperiment!);
  }
}
import { ReasonKinds } from "./ReasonKinds";
import { IFlag } from "./data/IFlag";
import { EvalEvent } from "../events/event";
import { IUser } from "../options/IUser";

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

  static flagNotFound(flagKey: string) {
    return new EvalResult(ReasonKinds.FlagNotFound, null, `flag not found: ${ flagKey }`);
  }

  static matched(val: IFlag) {
    return new EvalResult(ReasonKinds.Match, val, 'target match');
  }

  toEvalEvent(user: IUser): EvalEvent | null {
    if (this.kind !== ReasonKinds.Match) {
      return null;
    }

    const targetedVariation = this.value?.variations.find(v => v.value === this.value?.variation);
    return new EvalEvent(user, this.value?.id!, targetedVariation!, this.value?.sendToExperiment!);
  }
}
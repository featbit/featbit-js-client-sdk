// used only by tests
import { IFlag, VariationDataType, IVariation, FlagValue } from "../../evaluation/data/IFlag";

export class FlagBuilder {
  private _id: string = `xxxxx-${new Date().getTime()}-xxxxxx`;
  private _key?: string;
  private _version?: number;
  private _variationType: VariationDataType = VariationDataType.empty;
  private _sendToExperiment: boolean = false;
  private _variation: FlagValue = '';
  private _variations: IVariation[] = [];

  id(id: string): FlagBuilder {
    this._id = id;
    return this;
  }

  key(key: string): FlagBuilder {
    this._key = key;
    return this;
  }

  version(version: number): FlagBuilder {
    this._version = version
    return this;
  }

  sendToExperiment(val: boolean): FlagBuilder {
    this._sendToExperiment = val
    return this;
  }

  variation(variation: FlagValue): FlagBuilder {
    this._variation = variation
    return this;
  }

  variationType(variationType: VariationDataType): FlagBuilder {
    this._variationType = variationType
    return this;
  }

  variations(variations: IVariation[]): FlagBuilder {
    this._variations = variations
    return this;
  }

  build(): IFlag {
    return {
      id: this._id!,
      key: this._key!,
      version: this._version!,
      variationType: this._variationType,
      variations: this._variations,
      sendToExperiment: this._sendToExperiment,
      variation: this._variation,
      timestamp: new Date().getTime()
    };
  }
}
import { IUser } from "./IUser";
import {IContextProperty} from "../IContextProperty";

/**
 * Creates an instance of the FeatBit user.
 *
 * @return
 *   The new {@link IUser} instance.
 */
export class UserBuilder {
  private _keyId: string = '';
  private _name: string = '';
  private _custom: IContextProperty[] = [];

  constructor(keyId: string) {
    this._keyId = keyId;
  }

  name(name: string): UserBuilder {
    this._name = name;
    return this;
  }

  custom(propertyName: string, value: string): UserBuilder {
    this._custom?.push({ name: propertyName, value: `${value}` });
    return this;
  }

  build(): IUser {
    return {
      name: this._name,
      keyId: this._keyId,
      customizedProperties: this._custom
    };
  }
}
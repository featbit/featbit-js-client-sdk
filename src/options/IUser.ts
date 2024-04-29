import { IContextProperty } from "../IContextProperty";

export interface IUser {
  keyId: string;
  name?: string;
  customizedProperties?: IContextProperty[];
}
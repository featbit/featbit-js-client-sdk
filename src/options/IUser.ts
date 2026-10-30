import { IContextProperty } from "../IContextProperty.js";

export interface IUser {
  keyId: string;
  name?: string;
  customizedProperties?: IContextProperty[];
}
import { IUser } from '../options/IUser';

/** Capture a context without retaining the caller's mutable attribute array. */
export function copyUser(user: IUser): IUser {
  return { ...user, customizedProperties: user.customizedProperties?.map(property => ({ ...property })) };
}

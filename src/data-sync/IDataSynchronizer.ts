import { IUser } from "../options/IUser.js";

/**
 * The client data synchronizer
 *
 * The client uses this internally to retrieve updates from the FeatBit server.
 *
 * @ignore
 */
export interface IDataSynchronizer {
  /** Start or resume synchronization. Custom sources are restarted after Identify. */
  start: () => void;
  /** Stop pending work and prevent stale responses or completion callbacks. Must allow restart. */
  stop: () => void;
  close: () => void;
  /** Select the user. For custom sources, the client calls start() after this resolves. */
  identify: (user: IUser) => Promise<void>;
}

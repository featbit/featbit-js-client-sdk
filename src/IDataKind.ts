/**
 * Used internally to describe the type of data being queried or updated, such as feature flags or
 * user segments.
 */
export interface IDataKind {
  /**
   * A string such as `"flags"` or `"segments"` which can be used in keys to distinguish this
   * kind of data from other kinds.
   */
  namespace: string;
}

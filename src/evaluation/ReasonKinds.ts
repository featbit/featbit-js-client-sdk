/**
 * Different kinds of error which may be encountered during evaluation.
 */
export enum ReasonKinds {
  ClientNotReady = 'ClientNotReady',
  Match = 'Match',
  WrongType = 'WrongType',
  FlagNotFound = 'FlagNotFound',
  Error = 'Error'
}
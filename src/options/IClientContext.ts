import { ILogger } from "../logging/ILogger";
import { IPlatform } from "../platform/IPlatform";

/**
 * Factory methods receive this class as a parameter.
 *
 * Its public properties provide information about the SDK configuration and environment. The SDK
 * may also include non-public properties that are relevant only when creating one of the built-in
 * component types and are not accessible to custom components.
 */
export interface IClientContext {

  logger?: ILogger;

  /**
   * True if the SDK was configured to be completely offline.
   */
  offline?: boolean;

  /**
   * The configured SDK key.
   */
  sdkKey: string;

  /**
   * The base URI of the data-sync service
   */
  streamingUri: string;

  /**
   * The base URI of the polling service
   */
  pollingUri: string;

  /**
   * The base URI of the event service
   */
  eventsUri: string;

  /**
   * The interval in between flushes of events queue, in milliseconds.
   */
  flushInterval: number;

  /**
   * The max number of events in the events queue.
   */
  maxEventsInQueue: number;

  /**
   * Interfaces providing platform specific information and functionality.
   */
  platform: IPlatform;
}
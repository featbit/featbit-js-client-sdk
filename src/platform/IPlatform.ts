import { IRequests } from "./requests.js";
import { IInfo } from "./IInfo.js";
import { IWebSocketWithEvents } from "./IWebSocket.js";

export interface IPlatform {
  /**
   * The interface for getting information about the platform and the execution
   * environment.
   */
  info: IInfo;

  /**
   * The interface for performing http/https requests.
   */
  requests: IRequests;

  /**
   * The interface for performing websocket connections.
   */
  webSocket: IWebSocketWithEvents;
}
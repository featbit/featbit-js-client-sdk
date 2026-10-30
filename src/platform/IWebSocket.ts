import { IEventEmitter } from "../utils/IEventEmitter.js";
import { ILogger } from "../logging/ILogger.js";
import { IUser } from "../options/IUser.js";

export interface IWebSocketConfig {
  sdkKey: string;
  streamingUri: string;
  pingInterval: number;
  user: IUser;
  logger: ILogger;
  getStoreTimestamp: () => number,
  emitter?: IEventEmitter;
}

export interface IWebSocket {
  connect: () => void;
  close: () => void;
  config: (param: IWebSocketConfig) => void;
  identify: (user: IUser) => boolean;
}

export interface IWebSocketWithEvents extends IWebSocket, IEventEmitter {
}
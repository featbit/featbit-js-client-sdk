import { IEventEmitter } from "../utils/IEventEmitter";
import { ILogger } from "../logging/ILogger";
import { IUser } from "../options/IUser";

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
  identify: (user: IUser) => void;
}

export interface IWebSocketWithEvents extends IWebSocket, IEventEmitter {
}
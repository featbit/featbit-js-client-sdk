import { IPlatform } from "../IPlatform.js";
import { IInfo } from "../IInfo.js";
import { IRequests } from "../requests.js";
import { IOptions } from "../../options/IOptions.js";
import BrowserInfo from "./BrowserInfo.js";
import { BrowserRequests } from "./BrowserRequests.js";
import { IWebSocketWithEvents } from "../IWebSocket.js";
import BrowserWebSocket from "./BrowserWebSocket.js";

export class BrowserPlatform implements IPlatform {
  info: IInfo = new BrowserInfo();

  requests: IRequests;
  webSocket: IWebSocketWithEvents;

  constructor(options: IOptions) {
    this.requests = new BrowserRequests();
    this.webSocket = new BrowserWebSocket();
  }
}
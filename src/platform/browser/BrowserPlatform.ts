import { IPlatform } from "../IPlatform";
import { IInfo } from "../IInfo";
import { IRequests } from "../requests";
import { IOptions } from "../../options/IOptions";
import BrowserInfo from "./BrowserInfo";
import { BrowserRequests } from "./BrowserRequests";
import { IWebSocketWithEvents } from "../IWebSocket";
import BrowserWebSocket from "./BrowserWebSocket";

export class BrowserPlatform implements IPlatform {
  info: IInfo = new BrowserInfo();

  requests: IRequests;
  webSocket: IWebSocketWithEvents;

  constructor(options: IOptions) {
    this.requests = new BrowserRequests();
    this.webSocket = new BrowserWebSocket();
  }
}
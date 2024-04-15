import { websocketReconnectTopic } from "./constants";
import { eventHub } from "./events";
import { logger } from "./logger";
import { IInsight, InsightType, IStreamResponse, IUser } from "./types";
import { generateConnectionToken } from "./utils";
import throttleUtil from "./throttleutil";

const socketConnectionIntervals = [250, 500, 1000, 2000, 4000, 8000];

class NetworkService {
  private user: IUser | undefined;
  private streamingUri: string | undefined;
  private eventsUri: string | undefined;
  private secret: string | undefined;
  private appType: string | undefined;

  private retryCounter = 0;

  constructor(){}

  init(streamingUri: string, eventsUri: string, secret: string, appType: string) {
    this.streamingUri = streamingUri;
    this.eventsUri = eventsUri;
    this.secret = secret;
    this.appType = appType;
  }

  identify(user: IUser, sendIdentifyMessage: boolean) {
    this.user = { ...user };
    throttleUtil.setKey(this.user?.keyId);

    if (sendIdentifyMessage && this.socket) {
      this.sendUserIdentifyMessage(0);
    }
  }

  private sendUserIdentifyMessage(timestamp: number) {
    const { name, keyId, customizedProperties } = this.user!;
    const payload = {
      messageType: 'data-sync',
      data: {
        user: {
          name,
          keyId,
          customizedProperties,
        },
        timestamp
      }
    };

    try {
      if (this.socket?.readyState === WebSocket.OPEN) {
        logger.logDebug('sending user identify message');
        this.socket?.send(JSON.stringify(payload));
      } else {
        logger.logDebug(`didn't send user identify message because socket not open`);
      }
    } catch (err) {
      logger.logDebug(err);
    }
  }

  private socket: WebSocket | undefined | any;

  private reconnect() {
    this.socket = null;
    const waitTime = socketConnectionIntervals[Math.min(this.retryCounter++, socketConnectionIntervals.length - 1)];
    setTimeout(() => {
      logger.logDebug('emit reconnect event');
      eventHub.emit(websocketReconnectTopic, {});
    }, waitTime);
    logger.logDebug(waitTime);
  }

  private sendPingMessage() {
    const payload = {
      messageType: 'ping',
      data: null
    };

    setTimeout(() => {
      try {
        if (this.socket?.readyState === WebSocket.OPEN) {
          logger.logDebug('sending ping')
          this.socket.send(JSON.stringify(payload));
          this.sendPingMessage();
        } else {
          logger.logDebug(`socket closed at ${new Date()}`);
          this.reconnect();
        }
      } catch (err) {
        logger.logDebug(err);
      }
    }, 18000);
  }

  createConnection(timestamp: number, onMessage: (response: IStreamResponse) => any) {
    const that = this;
    if (that.socket) {
      onMessage({} as IStreamResponse);
      return;
    }

    const startTime = Date.now();
    // Create WebSocket connection.
    const url = `${this.streamingUri}/streaming?type=client&token=${generateConnectionToken(this.secret!)}`;
    that.socket = new WebSocket(url);

    // Connection opened
    that.socket.addEventListener('open', function (this: WebSocket, event) {
      that.retryCounter = 0;
      // this is the websocket instance to which the current listener is binded to, it's different from that.socket
      logger.logDebug(`Connection time: ${Date.now() - startTime} ms`);
      that.sendUserIdentifyMessage(timestamp);
      that.sendPingMessage();
    });
  
    // Connection closed
    that.socket.addEventListener('close', function (event) {
      logger.logDebug('close');
      if (event.code === 4003) { // do not reconnect when 4003
        return;
      }

      that.reconnect();
    });
  
    // Connection error
    that.socket!.addEventListener('error', function (event) {
      // reconnect
      logger.logDebug('error');
    });
  
    // Listen for messages
    that.socket.addEventListener('message', function (event) {
      const message = JSON.parse(event.data);
      if (message.messageType === 'data-sync') {
        onMessage(message.data);
        if (message.data.featureFlags.length > 0) {
          logger.logDebug('socket push update time(ms): ', Date.now() - message.data.featureFlags[0].timestamp);
        }
      }
    });
  }

  private __getUserInfo(): any {
    const { name, keyId, customizedProperties } = this.user!;
    return {
      name: name,
      keyId: keyId,
      customizedProperties: customizedProperties,
    }
  }

  sendInsights = throttleUtil.throttleAsync(async (data: IInsight[]): Promise<void> => {
    if (!this.secret || !this.user || !data || data.length === 0) {
      return;
    }
  
    try {
      const payload = [{
        user: this.__getUserInfo(),
        variations: data.filter(d => d.insightType === InsightType.featureFlagUsage).map(v => ({
          featureFlagKey: v.id,
          sendToExperiment: v.sendToExperiment,
          timestamp: v.timestamp,
          variation: {
            id: v.variation!.id,
            value: v.variation!.value
          }
        })),
        metrics: data.filter(d => d.insightType !== InsightType.featureFlagUsage).map(d => ({
          route: location.pathname,
          timestamp: d.timestamp,
          numericValue: d.numericValue === null || d.numericValue === undefined? 1 : d.numericValue,
          appType: this.appType,
          eventName: d.eventName,
          type: d.type
        }))
      }];
  
      await post(`${this.eventsUri}/api/public/insight/track`, payload, { Authorization: this.secret });
    } catch (err) {
      logger.logDebug(err);
    }
  })
}

export const networkService = new NetworkService();

export async function post(url: string = '', data: any = {}, headers: { [key: string]: string } = {}) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json'
      }, headers),
      body: JSON.stringify(data) // body data type must match "Content-Type" header
    });

    return response.status === 200 ? response.json() : {};
  } catch (err) {
    logger.logDebug(err);
    return {};
  }
}

export async function get(url: string = '', headers: { [key: string]: string } = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: Object.assign({
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }, headers)
    });

    return response.status === 200 ? response.json() : {};
  } catch (err) {
    logger.logDebug(err);
    return null;
  }
}

import { DeliveryStatus, IEventSender, IEventSenderResult } from "./IEventSender";
import ClientContext from "../options/ClientContext";
import { defaultHeaders, httpErrorMessage } from "../utils/http";
import { IRequests } from "../platform/requests";
import { isHttpRecoverable, UnexpectedResponseError } from "../errors";
import sleep from "../utils/sleep";

export class DefaultEventSender implements IEventSender {
  private readonly defaultHeaders: {
    [key: string]: string;
  };
  private readonly eventsUri: string;
  private requests: IRequests;

  constructor(clientContext: ClientContext) {
    const {
      sdkKey,
      eventsUri,
      platform
    } = clientContext;

    const {info, requests} = platform;
    this.defaultHeaders = defaultHeaders(sdkKey, info);
    this.eventsUri = eventsUri;
    this.requests = requests;
  }

  async send(payload: string, retry: boolean): Promise<IEventSenderResult> {
    const res: IEventSenderResult = {
      status: DeliveryStatus.Succeeded,
    };

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      'content-type': 'application/json',
    }

    let error;
    try {
      const {status} = await this.requests.fetch(this.eventsUri, {
        headers,
        body: payload,
        method: 'POST',
      });

      if (status >= 200 && status <= 299) {
        return res;
      }

      error = new UnexpectedResponseError(
        httpErrorMessage({status, message: 'some events were dropped'}, 'event posting'),
      );

      if (!isHttpRecoverable(status)) {
        res.status = DeliveryStatus.FailedAndMustShutDown;
        res.error = error;
        return res;
      }
    } catch (err) {
      error = err;
    }

    // recoverable but not retrying
    if (error && !retry) {
      res.status = DeliveryStatus.Failed;
      res.error = error;
      return res;
    }

    // wait 1 second before retrying
    await sleep();

    return this.send(payload, false);
  }
}
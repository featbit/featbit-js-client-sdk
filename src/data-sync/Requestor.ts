import { IRequestor } from "./IRequestor";
import Configuration from "../Configuration";
import { IInfo } from "../platform/IInfo";
import { IRequestOptions, IRequests, IResponse } from "../platform/requests";
import { StreamingError } from "../errors";
import { defaultHeaders } from "../utils/http";

/**
 * @internal
 */
export default class Requestor implements IRequestor {
  private readonly headers: Record<string, string>;

  private readonly uri: string;

  constructor(
    sdkKey: string,
    config: Configuration,
    info: IInfo,
    private readonly requests: IRequests,
  ) {
    this.headers = defaultHeaders(sdkKey, info);
    this.uri = config.pollingUri;
  }

  /**
   * Perform a request and utilize the ETag cache. The ETags are cached in the
   * requestor instance.
   */
  private async request(
    requestUrl: string,
    options: IRequestOptions,
  ): Promise<{
    res: IResponse;
    body: string;
  }> {
    const res = await this.requests.fetch(requestUrl, options);

    const body = await res.text();

    return {res, body};
  }

  async requestData(timestamp: number, payload: any, cb: (err: any, body: any) => void) {
    const options: IRequestOptions = {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    };
    try {
      const {res, body} = await this.request(`${ this.uri }?timestamp=${ timestamp ?? 0 }`, options);
      if (res.status !== 200 && res.status !== 304) {
        const err = new StreamingError(`Unexpected status code: ${ res.status }`, res.status);
        return cb(err, undefined);
      }
      return cb(undefined, res.status === 304 ? null : body);
    } catch (err) {
      return cb(err, undefined);
    }
  }
}

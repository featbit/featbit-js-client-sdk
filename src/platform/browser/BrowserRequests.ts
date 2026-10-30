import { IRequestOptions, IRequests } from "../requests.js";

export  class BrowserRequests implements IRequests {
  fetch(url: string, options: IRequestOptions = {}): Promise<any> {
    return fetch(url, options);
  }
}
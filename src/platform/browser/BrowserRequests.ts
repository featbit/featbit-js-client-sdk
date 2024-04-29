import { IRequestOptions, IRequests } from "../requests";

export default class BrowserRequests implements IRequests {
  fetch(url: string, options: IRequestOptions = {}): Promise<any> {
    return fetch(url, options);
  }
}
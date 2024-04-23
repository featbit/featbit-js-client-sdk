import Requestor from "../../src/data-sync/Requestor";
import { IHeaders, IRequestOptions, IRequests, IResponse } from "../../src/platform/requests";
import Configuration from "../../src/Configuration";
import BrowserInfo from "../../src/platform/browser/BrowserInfo";
import { version } from "../../src/version";

describe('given a requestor', () => {
  let requestor: Requestor;

  let requestsMade: Array<{ url: string; options: IRequestOptions }>;

  let testHeaders: Record<string, string>;
  let testStatus = 200;
  let testResponse: string | undefined;
  let throwThis: string | undefined;

  function resetRequestState() {
    requestsMade = [];
    testHeaders = {};
    testStatus = 200;
    testResponse = undefined;
    throwThis = undefined;
  }

  beforeEach(() => {
    resetRequestState();

    const requests: IRequests = {
      async fetch(url: string, options?: IRequestOptions): Promise<IResponse> {
        return new Promise<IResponse>((a, r) => {
          if (throwThis) {
            r(new Error(throwThis));
          }
          const headers: IHeaders = {
            get(name: string): string | null {
              return testHeaders[name] || null;
            },
            keys(): Iterable<string> {
              throw new Error('Function not implemented.');
            },
            values(): Iterable<string> {
              throw new Error('Function not implemented.');
            },
            entries(): Iterable<[string, string]> {
              throw new Error('Function not implemented.');
            },
            has(_name: string): boolean {
              throw new Error('Function not implemented.');
            },
          };

          const res: IResponse = {
            status: testStatus,
            async text(): Promise<string> {
              return testResponse ?? '';
            },
            json(): Promise<any> {
              throw new Error('Function not implemented.');
            },
          };
          requestsMade.push({url, options: options!});
          a(res);
        });
      },
    };

    requestor = new Requestor('sdkKey', new Configuration({pollingUri: 'http://localhost:5100'}), new BrowserInfo(), requests);
  });

  it('gets data', (done) => {
    testResponse = 'a response';
    requestor.requestData(0, 0, (err, body) => {
      expect(err).toBeUndefined();
      expect(body).toEqual(testResponse);

      expect(requestsMade.length).toBe(1);
      expect(requestsMade[0].url).toBe('http://localhost:5100/api/public/sdk/client/latest-all?timestamp=0');
      expect(requestsMade[0].options.headers?.Authorization).toBe('sdkKey');
      expect(requestsMade[0].options.headers?.['User-Agent']).toBe(`Browser-Client-SDK/${version}`);
      done();
    });
  });

  it('returns an error result for an http error', (done) => {
    testStatus = 401;
    requestor.requestData(0,0, (err, _body) => {
      expect(err).toBeDefined();
      done();
    });
  });

  it('returns an error result for a network error', (done) => {
    throwThis = 'SOMETHING BAD';
    requestor.requestData(0,0, (err, _body) => {
      expect(err.message).toBe(throwThis);
      done();
    });
  });

  it('Receives data', async () => {
    testHeaders.etag = 'abc123';
    testResponse = 'a response';
    const res1 = await new Promise<{ err: any; body: any }>((cb) => {
      requestor.requestData(0, 0, (err, body) => cb({err, body}));
    });
    testStatus = 304;
    const res2 = await new Promise<{ err: any; body: any }>((cb) => {
      requestor.requestData(0, 0, (err, body) => cb({err, body}));
    });
    expect(res1.err).toBeUndefined();
    expect(res1.body).toEqual(testResponse);
    expect(res2.err).toBeUndefined();
    expect(res2.body).toEqual(null);
  });
});

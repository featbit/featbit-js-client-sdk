import Configuration from "../../src/Configuration";
import PollingDataSynchronizer from "../../src/data-sync/PollingDataSynchronizer";
import { ProcessStreamResponse } from "../../src/data-sync/types";
import Requestor from "../../src/data-sync/Requestor";
import { UserBuilder } from "../../src";

describe('PollingDataSynchronizer', () => {
  it('associates a response with the user that requested it', () => {
    const firstUser = new UserBuilder('first-user').name('first-user').build();
    const secondUser = new UserBuilder('second-user').name('second-user').build();
    const requests: Array<{
      userKeyId: string;
      callback: (err?: any, body?: string) => void;
    }> = [];
    const requestor = {
      requestData: (_timestamp: number, user: typeof firstUser, callback: (err?: any, body?: string) => void) => {
        requests.push({userKeyId: user.keyId, callback});
      },
    } as unknown as Requestor;
    const processJson = jest.fn<boolean, [string, any]>(() => false);
    const listener: ProcessStreamResponse = {
      deserializeData: flags => flags,
      processJson,
    };
    const listeners = new Map([['patch', listener]]) as any;
    const synchronizer = new PollingDataSynchronizer(
      new Configuration({
        user: firstUser,
        pollingInterval: 60_000,
      }),
      requestor,
      () => 0,
      listeners,
    );

    synchronizer.start();
    void synchronizer.identify(secondUser);

    expect(requests.map(request => request.userKeyId)).toEqual(['first-user', 'second-user']);
    requests[0].callback(undefined, undefined);
    expect(processJson).toHaveBeenCalledWith('first-user', []);

    synchronizer.stop();
  });
});

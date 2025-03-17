import { IInfo } from "../platform/IInfo";

export type Headers = {
  Authorization: string;
  'X-User-Agent': string;
  'Content-Type': string;
};

export function defaultHeaders(
  sdkKey: string,
  info: IInfo
): Headers {
  const {userAgent, version} = info.sdkData();

  const headers: Headers = {
    'Content-Type': 'application/json',
    'X-User-Agent': userAgent ?? `${info.appType}/${version}`,
    'Authorization': sdkKey
  };

  return headers;
}

export function httpErrorMessage(
  err: {
    status: number;
    message: string;
  },
  context: string,
  retryMessage?: string,
): string {
  let desc;
  if (err.status) {
    desc = `error ${ err.status }${ err.status === 401 ? ' (invalid SDK key)' : '' }`;
  } else {
    desc = `I/O error (${ err.message || err })`;
  }
  const action = retryMessage ?? 'giving up permanently';
  return `Received ${ desc } for ${ context } - ${ action }`;
}

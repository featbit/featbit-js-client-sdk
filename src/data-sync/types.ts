import { PollingError } from "../errors";
import { IFlag } from "../evaluation/data/IFlag";

export type PollingErrorHandler = (err: PollingError) => void;

export enum StreamResponseEventType {
  full = 'full',
  patch = 'patch'
}

export interface IStreamResponse {
  eventType: StreamResponseEventType,
  featureFlags: IFlag[]
}

export type EventName = 'delete' | 'patch' | 'ping' | 'put';
export type ProcessStreamResponse = {
  deserializeData: (flags: IFlag[]) => any;
  processJson: (userKeyId: string, json: any) => void;
};
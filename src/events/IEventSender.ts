export enum DeliveryStatus {
  Succeeded,
  Failed,
  FailedAndMustShutDown
}

export interface IEventSenderResult {
  status: DeliveryStatus,
  error?: any
}

export interface IEventSender {
  send(payload: string, retry: boolean): Promise<IEventSenderResult>;
}
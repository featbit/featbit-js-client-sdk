import { ILogger } from "../logging/ILogger";

export class TestLogger implements ILogger {
  public logs: string[] = [];

  error(...args: any[]): void {
    this.logs.push(args.join(' '));
  }

  warn(...args: any[]): void {
    this.logs.push(args.join(' '));
  }

  info(...args: any[]): void {
    this.logs.push(args.join(' '));
  }

  debug(...args: any[]): void {
    this.logs.push(args.join(' '));
  }

  reset() {
    this.logs = [];
  }
}
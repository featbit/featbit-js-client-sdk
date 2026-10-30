export const defaultFullSyncInterval = 24 * 60 * 60 * 1000;

/** Shared by streaming and its polling fallback. Only committed full snapshots acknowledge it. */
export default class FullSyncPolicy {
  private nextFullAt = 0;

  constructor(private readonly interval = defaultFullSyncInterval) {}

  reset(): void {
    this.nextFullAt = 0;
  }

  get due(): boolean {
    return Date.now() >= this.nextFullAt;
  }

  timestamp(cursor: number): number {
    return this.due ? 0 : cursor;
  }

  committed(): void {
    this.nextFullAt = Date.now() + this.interval * (0.9 + Math.random() * 0.2);
  }

  /** Bound timer delays and pace retries while a full snapshot is still pending. */
  get delay(): number {
    const remaining = this.nextFullAt - Date.now();
    return Math.min(0x7fffffff, remaining > 0 ? remaining : 30000);
  }
}

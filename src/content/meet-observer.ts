import { MeetAdapter, MeetObservationSnapshot } from "./meet-adapter";

export type ObservationCallback = (snapshot: MeetObservationSnapshot) => void;

export class MeetObserver {
  private observer: MutationObserver | null = null;
  private intervalTimer: number | null = null;
  private isObserving = false;
  private callback: ObservationCallback;
  private readonly TICK_INTERVAL_MS = 2000; // Controlled 2-second reconciliation interval

  constructor(callback: ObservationCallback) {
    this.callback = callback;
  }

  public start(): void {
    if (this.isObserving) return;
    this.isObserving = true;

    // 1. Initial snapshot
    this.triggerSnapshot();

    // 2. Controlled interval ticker
    this.intervalTimer = window.setInterval(() => {
      this.triggerSnapshot();
    }, this.TICK_INTERVAL_MS);

    // 3. MutationObserver to capture sudden DOM additions (like new attendees)
    this.observer = new MutationObserver(() => {
      // Debounced or let the interval take care of controlled reconciliation
      // to avoid overwhelming Chrome with continuous re-renders
    });

    try {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      console.warn("[Attendly] Could not attach MutationObserver to document.body:", e);
    }
  }

  public stop(): void {
    if (!this.isObserving) return;
    this.isObserving = false;

    if (this.intervalTimer !== null) {
      window.clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  public triggerSnapshot(): void {
    try {
      const snapshot = MeetAdapter.captureSnapshot();
      this.callback(snapshot);
    } catch (err) {
      console.error("[Attendly] Snapshot capture error:", err);
    }
  }
}

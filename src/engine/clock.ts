// The engine is driven off event timestamps, not wall-clock time, so the
// replay (and scheduler ticks within it) are deterministic and fast
// regardless of the real ~90-minute span the sample data covers. Tests
// advance this directly instead of mocking global timers.
export class SimulatedClock {
  private currentMs: number;

  constructor(start: Date) {
    this.currentMs = start.getTime();
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  set(date: Date): void {
    this.currentMs = date.getTime();
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }
}

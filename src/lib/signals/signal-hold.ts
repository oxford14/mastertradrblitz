import type { Signal } from '../../types';

export interface HoldState {
  signal: Signal;
  confirming: boolean;
  holdSecondsRemaining: number;
  pendingSignal: Signal;
}

export class SignalHoldTracker {
  private pending: Signal = 'WAIT';
  private pendingSince: number | null = null;

  onBarClose(rawSignal: Signal, now: number): void {
    if (rawSignal === 'WAIT') {
      this.reset();
      return;
    }

    if (rawSignal === this.pending && this.pendingSince !== null) {
      return;
    }

    this.pending = rawSignal;
    this.pendingSince = now;
  }

  getState(now: number, holdMs: number): HoldState {
    if (this.pending === 'WAIT' || this.pendingSince === null) {
      return {
        signal: 'WAIT',
        confirming: false,
        holdSecondsRemaining: 0,
        pendingSignal: 'WAIT',
      };
    }

    const elapsed = now - this.pendingSince;
    if (elapsed >= holdMs) {
      return {
        signal: this.pending,
        confirming: false,
        holdSecondsRemaining: 0,
        pendingSignal: this.pending,
      };
    }

    return {
      signal: 'WAIT',
      confirming: true,
      holdSecondsRemaining: Math.ceil((holdMs - elapsed) / 1000),
      pendingSignal: this.pending,
    };
  }

  reset(): void {
    this.pending = 'WAIT';
    this.pendingSince = null;
  }
}

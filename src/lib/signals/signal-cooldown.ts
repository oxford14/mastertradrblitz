import type { Signal } from '../../types';

export interface CooldownState {
  locked: boolean;
  lockedSignal: Signal;
  secondsRemaining: number;
}

export class SignalCooldownTracker {
  private lockedSignal: Signal = 'WAIT';
  private lockedUntil: number | null = null;

  onSignalConfirmed(signal: Signal, now: number, durationMs: number): void {
    if (signal !== 'HIGHER' && signal !== 'LOWER') return;
    if (durationMs <= 0) return;
    this.lockedSignal = signal;
    this.lockedUntil = now + durationMs;
  }

  canAcceptNewBarSignal(now: number): boolean {
    if (this.lockedUntil === null) return true;
    if (now >= this.lockedUntil) {
      this.lockedUntil = null;
      this.lockedSignal = 'WAIT';
      return true;
    }
    return false;
  }

  isActive(now: number): boolean {
    return this.lockedUntil !== null && now < this.lockedUntil;
  }

  getDisplaySignal(
    now: number,
    candidate: Signal,
  ): CooldownState & { signal: Signal } {
    if (this.lockedUntil !== null && now < this.lockedUntil) {
      return {
        locked: true,
        lockedSignal: this.lockedSignal,
        signal: this.lockedSignal,
        secondsRemaining: Math.ceil((this.lockedUntil - now) / 1000),
      };
    }

    if (this.lockedUntil !== null && now >= this.lockedUntil) {
      this.lockedUntil = null;
      this.lockedSignal = 'WAIT';
    }

    return {
      locked: false,
      lockedSignal: 'WAIT',
      signal: candidate,
      secondsRemaining: 0,
    };
  }

  reset(): void {
    this.lockedSignal = 'WAIT';
    this.lockedUntil = null;
  }
}

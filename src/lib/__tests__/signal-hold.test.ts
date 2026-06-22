import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SignalHoldTracker } from '../signals/signal-hold';

describe('SignalHoldTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires hold duration before confirming', () => {
    const tracker = new SignalHoldTracker();
    tracker.onBarClose('HIGHER', Date.now());

    let state = tracker.getState(Date.now(), 2000);
    expect(state.confirming).toBe(true);
    expect(state.signal).toBe('WAIT');
    expect(state.holdSecondsRemaining).toBe(2);

    vi.advanceTimersByTime(1000);
    state = tracker.getState(Date.now(), 2000);
    expect(state.confirming).toBe(true);
    expect(state.holdSecondsRemaining).toBe(1);

    vi.advanceTimersByTime(1100);
    state = tracker.getState(Date.now(), 2000);
    expect(state.confirming).toBe(false);
    expect(state.signal).toBe('HIGHER');
  });

  it('resets when bar close returns WAIT', () => {
    const tracker = new SignalHoldTracker();
    tracker.onBarClose('LOWER', Date.now());
    tracker.onBarClose('WAIT', Date.now());

    const state = tracker.getState(Date.now(), 2000);
    expect(state.signal).toBe('WAIT');
    expect(state.confirming).toBe(false);
  });

  it('restarts hold when direction changes', () => {
    const tracker = new SignalHoldTracker();
    tracker.onBarClose('HIGHER', Date.now());
    vi.advanceTimersByTime(2000);
    tracker.onBarClose('LOWER', Date.now());

    const state = tracker.getState(Date.now(), 2000);
    expect(state.confirming).toBe(true);
    expect(state.pendingSignal).toBe('LOWER');
    expect(state.holdSecondsRemaining).toBe(2);
  });
});

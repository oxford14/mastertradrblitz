import { describe, expect, it } from 'vitest';
import { SignalCooldownTracker } from '../signals/signal-cooldown';

describe('SignalCooldownTracker', () => {
  it('locks display signal for configured duration', () => {
    const tracker = new SignalCooldownTracker();
    tracker.onSignalConfirmed('HIGHER', 1000, 5000);

    const during = tracker.getDisplaySignal(3000, 'WAIT');
    expect(during.locked).toBe(true);
    expect(during.signal).toBe('HIGHER');
    expect(during.secondsRemaining).toBe(3);

    const after = tracker.getDisplaySignal(7000, 'LOWER');
    expect(after.locked).toBe(false);
    expect(after.signal).toBe('LOWER');
  });

  it('blocks new bar signals while locked', () => {
    const tracker = new SignalCooldownTracker();
    tracker.onSignalConfirmed('LOWER', 0, 5000);
    expect(tracker.canAcceptNewBarSignal(2000)).toBe(false);
    expect(tracker.canAcceptNewBarSignal(6000)).toBe(true);
  });

  it('skips lock when duration is zero', () => {
    const tracker = new SignalCooldownTracker();
    tracker.onSignalConfirmed('HIGHER', 0, 0);
    expect(tracker.isActive(0)).toBe(false);
  });
});

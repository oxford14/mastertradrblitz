import { parseWsPayload } from '../lib/exnova/parser';
import { ActiveSymbolTracker } from '../lib/market/active-symbol';
import { CandleAggregator } from '../lib/market/candle-aggregator';
import { CandleStore } from '../lib/market/candle-store';
import { IndicatorEngine } from '../lib/indicators/indicator-engine';
import { evaluateSignal } from '../lib/signals/signal-engine';
import {
  attachAiToSignalResult,
  resetAiDecisionState,
  resolveBarCloseDecision,
  resolveLiveDisplayEval,
} from '../lib/decision/decision-adapter';
import { detectEngulfing } from '../lib/patterns/candle-pattern-engine';
import { detectRejectionWick } from '../lib/patterns/rejection-wick';
import { computeAdx } from '../lib/indicators/adx';
import { detectFractals } from '../lib/patterns/fractal';
import { SignalHoldTracker } from '../lib/signals/signal-hold';
import { SignalCooldownTracker } from '../lib/signals/signal-cooldown';
import { loadSettings } from '../lib/settings/storage';
import type {
  AppSettings,
  MarketEvent,
  Signal,
  SignalResult,
  TradeDirection,
  WsBridgeMessage,
} from '../types';

function eventPrice(event: MarketEvent): number {
  return event.type === 'tick' ? event.price : event.ohlc.close;
}

interface BarCloseSnapshot {
  signal: Signal;
  tradeDirection: TradeDirection;
  aiConfidence: number;
}

const emptyBarClose = (): BarCloseSnapshot => ({
  signal: 'WAIT',
  tradeDirection: null,
  aiConfidence: 0,
});

interface TradeConfirmedEvent {
  signal: Signal;
  warmedUp: boolean;
  aiConfidence: number;
}

export interface TradePlacementGate {
  canPlaceTrade(now: number): boolean;
  secondsUntilReady(now: number): number;
}

export class TradingPipeline {
  readonly store = new CandleStore();
  private aggregator: CandleAggregator;
  private indicatorEngine: IndicatorEngine;
  private symbolTracker = new ActiveSymbolTracker();
  private holdTracker = new SignalHoldTracker();
  private cooldownTracker = new SignalCooldownTracker();
  private settings: AppSettings;
  private lastResult: SignalResult | null = null;
  private lastBarCloseRaw: BarCloseSnapshot = emptyBarClose();
  private wasConfirming = false;
  private resultListeners = new Set<(r: SignalResult) => void>();
  private tradeConfirmListeners = new Set<(e: TradeConfirmedEvent) => void>();
  private holdTimer: ReturnType<typeof setInterval> | null = null;
  private instantConfirmBarTs: number | null = null;
  private tradeGate: TradePlacementGate | null = null;
  private activeSymbol = '';

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.aggregator = new CandleAggregator(settings.market.candleIntervalSec);
    this.indicatorEngine = new IndicatorEngine(settings);
    this.store.setIntervalSec(settings.market.candleIntervalSec);
    this.startHoldTimer();

    this.symbolTracker.setOnChange(() => {
      this.activeSymbol = this.symbolTracker.getPrimaryId() ?? '';
      this.store.clear();
      this.holdTracker.reset();
      this.cooldownTracker.reset();
      this.instantConfirmBarTs = null;
      resetAiDecisionState();
      this.aggregator = new CandleAggregator(this.settings.market.candleIntervalSec);
      this.indicatorEngine.updateSettings(this.settings);
      this.recompute(false);
    });
  }

  onResult(listener: (r: SignalResult) => void): () => void {
    this.resultListeners.add(listener);
    if (this.lastResult) listener(this.lastResult);
    return () => this.resultListeners.delete(listener);
  }

  onTradeConfirmed(listener: (e: TradeConfirmedEvent) => void): () => void {
    this.tradeConfirmListeners.add(listener);
    return () => this.tradeConfirmListeners.delete(listener);
  }

  private emitTradeConfirmed(
    signal: Signal,
    warmedUp: boolean,
    aiConfidence: number,
  ): void {
    const event: TradeConfirmedEvent = { signal, warmedUp, aiConfidence };
    for (const l of this.tradeConfirmListeners) l(event);
  }

  getLastResult(): SignalResult | null {
    return this.lastResult;
  }

  updateSettings(settings: AppSettings): void {
    const modeChanged = this.settings.tradingMode !== settings.tradingMode;
    this.settings = settings;
    if (modeChanged) {
      resetAiDecisionState();
      if (settings.tradingMode !== 'AI') {
        this.holdTracker.reset();
        this.lastBarCloseRaw = emptyBarClose();
        this.wasConfirming = false;
      }
    }
    this.aggregator.setIntervalSec(settings.market.candleIntervalSec);
    this.store.setIntervalSec(settings.market.candleIntervalSec);
    this.indicatorEngine.updateSettings(settings);
    this.recompute(false);
  }

  handleWsMessage(data: string | ArrayBuffer): void {
    const events = parseWsPayload(data, { devLog: this.settings.devLogWs });
    let barClosed = false;

    for (const event of events) {
      const price = eventPrice(event);
      if (!this.symbolTracker.accept(event.symbol, price)) continue;
      this.activeSymbol = event.symbol;

      if (event.type === 'candle' && event.isClosed) {
        this.store.addClosed({
          symbol: event.symbol,
          intervalSec: event.intervalSec,
          timestamp: event.ts,
          ...event.ohlc,
        });
        barClosed = true;
      } else if (event.type === 'tick') {
        const { closed, forming } = this.aggregator.processTick(
          event.symbol,
          event.price,
          event.ts,
        );
        if (closed) {
          this.store.addClosed(closed);
          barClosed = true;
        }
        if (forming) this.store.setForming(forming);
      } else if (event.type === 'candle' && !event.isClosed) {
        this.store.setForming({
          symbol: event.symbol,
          intervalSec: event.intervalSec,
          timestamp: event.ts,
          ...event.ohlc,
        });
      }
    }

    this.recompute(barClosed);
  }

  setWsConnected(connected: boolean): void {
    this.store.setWsConnected(connected);
  }

  dispose(): void {
    if (this.holdTimer) {
      clearInterval(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private startHoldTimer(): void {
    if (this.holdTimer) clearInterval(this.holdTimer);
    this.holdTimer = setInterval(() => {
      const now = Date.now();
      if (
        this.lastResult?.confirming ||
        this.cooldownTracker.isActive(now) ||
        !this.canPlaceTrade(now)
      ) {
        this.recompute(false);
      }
    }, 250);
  }

  getTradeExpirySec(): number {
    return this.settings.market.tradeExpirySec;
  }

  setTradePlacementGate(gate: TradePlacementGate | null): void {
    this.tradeGate = gate;
  }

  private cooldownDurationMs(): number {
    return Math.max(
      this.settings.market.signalCooldownSec * 1000,
      this.settings.market.tradeExpirySec * 1000,
    );
  }

  private canPlaceTrade(now: number): boolean {
    return this.tradeGate?.canPlaceTrade(now) ?? true;
  }

  private recompute(barClosed: boolean, aiSignalArrived = false): void {
    const now = Date.now();
    const closedCandles = this.store.getClosedCandles();
    const closedIndicators = this.indicatorEngine.computeFromCandles(closedCandles);
    const displayIndicators = this.indicatorEngine.computeFromCandles(
      this.store.getDisplayCandles(),
    );
    displayIndicators.warmupCurrent = closedIndicators.warmupCurrent;
    displayIndicators.warmupRequired = closedIndicators.warmupRequired;
    displayIndicators.warmedUp = closedIndicators.warmedUp;

    const pattern = detectEngulfing(closedCandles);
    const wick = detectRejectionWick(closedCandles);
    const adxResult = computeAdx(closedCandles, this.settings.adx.period);
    const fractal = detectFractals(closedCandles);

    if (
      barClosed &&
      this.cooldownTracker.canAcceptNewBarSignal(now) &&
      this.canPlaceTrade(now)
    ) {
      const prevClose = closedCandles[closedCandles.length - 2]?.close;
      if (this.settings.tradingMode !== 'AI') {
        const raw = evaluateSignal(
          closedIndicators,
          pattern,
          wick,
          this.settings,
          adxResult,
          fractal,
        );
        this.lastBarCloseRaw = {
          signal: raw.signal,
          tradeDirection: raw.tradeDirection,
          aiConfidence: raw.confidence?.total ?? 0,
        };
        this.holdTracker.onBarClose(raw.signal, now);
      } else {
        void resolveBarCloseDecision({
          settings: this.settings,
          asset: this.activeSymbol || closedCandles[closedCandles.length - 1]?.symbol || 'UNKNOWN',
          indicators: closedIndicators,
          pattern,
          wick,
          adxResult,
          fractal,
          prevClose,
        }).then(({ signal, raw }) => {
          if (this.settings.tradingMode !== 'AI') return;
          this.lastBarCloseRaw = {
            signal,
            tradeDirection: raw.tradeDirection,
            aiConfidence: raw.confidence?.total ?? 0,
          };
          // The AI decision resolves asynchronously (API latency), so start the
          // hold window from when the decision actually arrives — not the stale
          // bar-close timestamp — and allow this pass to emit the trade.
          this.holdTracker.onBarClose(signal, Date.now());
          this.recompute(false, true);
        });
      }
    }

    const holdMs = this.settings.market.signalHoldSec * 1000;
    const hold = this.holdTracker.getState(now, holdMs);
    const closedBarTs = closedCandles[closedCandles.length - 1]?.timestamp ?? null;
    const canEmitTrade =
      this.cooldownTracker.canAcceptNewBarSignal(now) && this.canPlaceTrade(now);
    const cooldownMs = this.cooldownDurationMs();

    if (
      canEmitTrade &&
      this.wasConfirming &&
      !hold.confirming &&
      (hold.signal === 'HIGHER' || hold.signal === 'LOWER')
    ) {
      this.cooldownTracker.onSignalConfirmed(hold.signal, now, cooldownMs);
      this.emitTradeConfirmed(
        hold.signal,
        closedIndicators.warmedUp,
        this.lastBarCloseRaw.aiConfidence,
      );
    } else if (
      canEmitTrade &&
      (barClosed || aiSignalArrived) &&
      holdMs === 0 &&
      !hold.confirming &&
      (hold.signal === 'HIGHER' || hold.signal === 'LOWER') &&
      closedBarTs !== null &&
      closedBarTs !== this.instantConfirmBarTs
    ) {
      this.cooldownTracker.onSignalConfirmed(hold.signal, now, cooldownMs);
      this.instantConfirmBarTs = closedBarTs;
      this.emitTradeConfirmed(
        hold.signal,
        closedIndicators.warmedUp,
        this.lastBarCloseRaw.aiConfidence,
      );
    }
    this.wasConfirming = hold.confirming;

    const cooldown = this.cooldownTracker.getDisplaySignal(
      now,
      hold.confirming ? 'WAIT' : hold.signal,
    );

    let liveEval = resolveLiveDisplayEval({
      settings: this.settings,
      indicators: displayIndicators,
      pattern,
      wick,
      adxResult,
      fractal,
    });
    if (cooldown.locked) {
      liveEval = resolveLiveDisplayEval({
        settings: this.settings,
        indicators: displayIndicators,
        pattern,
        wick,
        adxResult,
        fractal,
        reason: `Signal locked (${cooldown.secondsRemaining}s remaining)`,
      });
    } else if (!this.canPlaceTrade(now)) {
      const tradeWaitSec = this.tradeGate?.secondsUntilReady(now) ?? 0;
      if (tradeWaitSec > 0) {
        liveEval = resolveLiveDisplayEval({
          settings: this.settings,
          indicators: displayIndicators,
          pattern,
          wick,
          adxResult,
          fractal,
          reason: `Waiting for trade to close (${tradeWaitSec}s remaining)`,
        });
      }
    }

    const closedCandlesForCtx = this.store.getClosedCandles();
    const prevClose =
      closedCandlesForCtx[closedCandlesForCtx.length - 2]?.close;

    const result: SignalResult = attachAiToSignalResult(
      {
        signal: cooldown.locked
          ? cooldown.signal
          : hold.confirming
            ? 'WAIT'
            : hold.signal,
        rawSignal: this.lastBarCloseRaw.signal,
        confirming: cooldown.locked ? false : hold.confirming,
        holdSecondsRemaining: hold.holdSecondsRemaining,
        tradeDirection: liveEval.tradeDirection,
        activeCheck: liveEval.activeCheck,
        debug: liveEval.debug,
        indicators: displayIndicators,
        pattern: liveEval.pattern,
        dualConfidence: liveEval.dualConfidence,
        confidence: liveEval.confidence,
        signalDebugMode: this.settings.market.signalDebugMode,
        crossValidityBars: this.settings.stochastic.crossValidityBars,
      },
      this.settings,
      this.settings.tradingMode === 'AI'
        ? {
            asset:
              this.activeSymbol ||
              closedCandlesForCtx[closedCandlesForCtx.length - 1]?.symbol ||
              'UNKNOWN',
            indicators: displayIndicators,
            pattern,
            wick,
            adxResult,
            fractal,
            prevClose,
          }
        : undefined,
    );

    this.lastResult = result;
    for (const l of this.resultListeners) l(result);
  }
}

export function isWsBridgeMessage(data: unknown): data is WsBridgeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as WsBridgeMessage).source === 'mtb-ws'
  );
}

export async function createPipeline(): Promise<TradingPipeline> {
  const settings = await loadSettings();
  return new TradingPipeline(settings);
}

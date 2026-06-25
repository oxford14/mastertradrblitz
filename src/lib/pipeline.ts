import { parseWsPayload } from '../lib/exnova/parser';
import { ActiveSymbolTracker } from '../lib/market/active-symbol';
import { CandleAggregator } from '../lib/market/candle-aggregator';
import { CandleStore } from '../lib/market/candle-store';
import { IndicatorEngine } from '../lib/indicators/indicator-engine';
import { evaluateSignal } from '../lib/signals/signal-engine';
import { detectEngulfing } from '../lib/patterns/candle-pattern-engine';
import { detectRejectionWick } from '../lib/patterns/rejection-wick';
import { computeAdx } from '../lib/indicators/adx';
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
}

const emptyBarClose = (): BarCloseSnapshot => ({
  signal: 'WAIT',
  tradeDirection: null,
});

interface TradeConfirmedEvent {
  signal: Signal;
  warmedUp: boolean;
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

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.aggregator = new CandleAggregator(settings.market.candleIntervalSec);
    this.indicatorEngine = new IndicatorEngine(settings);
    this.store.setIntervalSec(settings.market.candleIntervalSec);
    this.startHoldTimer();

    this.symbolTracker.setOnChange(() => {
      this.store.clear();
      this.holdTracker.reset();
      this.cooldownTracker.reset();
      this.instantConfirmBarTs = null;
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

  private emitTradeConfirmed(signal: Signal, warmedUp: boolean): void {
    const event: TradeConfirmedEvent = { signal, warmedUp };
    for (const l of this.tradeConfirmListeners) l(event);
  }

  getLastResult(): SignalResult | null {
    return this.lastResult;
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
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

  private startHoldTimer(): void {
    if (this.holdTimer) clearInterval(this.holdTimer);
    this.holdTimer = setInterval(() => {
      const now = Date.now();
      if (
        this.lastResult?.confirming ||
        this.cooldownTracker.isActive(now)
      ) {
        this.recompute(false);
      }
    }, 250);
  }

  getTradeExpirySec(): number {
    return this.settings.market.tradeExpirySec;
  }

  private recompute(barClosed: boolean): void {
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

    if (barClosed && this.cooldownTracker.canAcceptNewBarSignal(now)) {
      const raw = evaluateSignal(
        closedIndicators,
        pattern,
        wick,
        this.settings,
        adxResult,
      );
      this.lastBarCloseRaw = {
        signal: raw.signal,
        tradeDirection: raw.tradeDirection,
      };
      this.holdTracker.onBarClose(raw.signal, now);
    }

    const holdMs = this.settings.market.signalHoldSec * 1000;
    const hold = this.holdTracker.getState(now, holdMs);
    const closedBarTs = closedCandles[closedCandles.length - 1]?.timestamp ?? null;
    const canEmitTrade = this.cooldownTracker.canAcceptNewBarSignal(now);

    if (
      canEmitTrade &&
      this.wasConfirming &&
      !hold.confirming &&
      (hold.signal === 'HIGHER' || hold.signal === 'LOWER')
    ) {
      this.cooldownTracker.onSignalConfirmed(
        hold.signal,
        now,
        this.settings.market.signalCooldownSec * 1000,
      );
      this.emitTradeConfirmed(hold.signal, closedIndicators.warmedUp);
    } else if (
      canEmitTrade &&
      barClosed &&
      holdMs === 0 &&
      !hold.confirming &&
      (hold.signal === 'HIGHER' || hold.signal === 'LOWER') &&
      closedBarTs !== null &&
      closedBarTs !== this.instantConfirmBarTs
    ) {
      this.cooldownTracker.onSignalConfirmed(
        hold.signal,
        now,
        this.settings.market.signalCooldownSec * 1000,
      );
      this.instantConfirmBarTs = closedBarTs;
      this.emitTradeConfirmed(hold.signal, closedIndicators.warmedUp);
    }
    this.wasConfirming = hold.confirming;

    const cooldown = this.cooldownTracker.getDisplaySignal(
      now,
      hold.confirming ? 'WAIT' : hold.signal,
    );

    let liveEval = evaluateSignal(
      displayIndicators,
      pattern,
      wick,
      this.settings,
      adxResult,
    );
    if (cooldown.locked) {
      liveEval = evaluateSignal(
        displayIndicators,
        pattern,
        wick,
        this.settings,
        adxResult,
        `Signal locked (${cooldown.secondsRemaining}s remaining)`,
      );
    }

    const result: SignalResult = {
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
    };

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

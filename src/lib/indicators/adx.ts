import type { Candle } from '../../types';

export interface AdxResult {
  adx: number;
  plusDi: number;
  minusDi: number;
}

function wilderSmooth(prev: number, current: number, period: number): number {
  return prev - prev / period + current;
}

export function computeAdx(
  candles: readonly Candle[],
  period: number,
): AdxResult {
  if (candles.length < period + 1) {
    return { adx: 0, plusDi: 0, minusDi: 0 };
  }

  const trs: number[] = [];
  const plusDms: number[] = [];
  const minusDms: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;

    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);

    let plusDm = 0;
    let minusDm = 0;
    if (upMove > downMove && upMove > 0) plusDm = upMove;
    if (downMove > upMove && downMove > 0) minusDm = downMove;

    plusDms.push(plusDm);
    minusDms.push(minusDm);
  }

  if (trs.length < period) {
    return { adx: 0, plusDi: 0, minusDi: 0 };
  }

  let smoothTr = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPlus = plusDms.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMinus = minusDms.slice(0, period).reduce((a, b) => a + b, 0);

  const dxValues: number[] = [];

  const pushDx = () => {
    const plusDi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
    const minusDi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;
    const diSum = plusDi + minusDi;
    const dx = diSum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / diSum;
    dxValues.push(dx);
  };

  pushDx();

  for (let i = period; i < trs.length; i++) {
    smoothTr = wilderSmooth(smoothTr, trs[i], period);
    smoothPlus = wilderSmooth(smoothPlus, plusDms[i], period);
    smoothMinus = wilderSmooth(smoothMinus, minusDms[i], period);
    pushDx();
  }

  if (dxValues.length < period) {
    const plusDi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
    const minusDi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;
    return { adx: 0, plusDi, minusDi };
  }

  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  const plusDi = smoothTr === 0 ? 0 : (100 * smoothPlus) / smoothTr;
  const minusDi = smoothTr === 0 ? 0 : (100 * smoothMinus) / smoothTr;

  return { adx, plusDi, minusDi };
}

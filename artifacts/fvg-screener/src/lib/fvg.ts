export interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
}

export type FvgType = "bullish" | "bearish";

export interface FvgResult {
  instId: string;
  fvgDate: Date;
  fvgType: FvgType;
  level1: number;
  level2: number;
  gapPercentage: number;
  candleIdx: number;
  volRank: number;
}

export function detectFvg(candles: Candle[], bodyMultiplier = 1.5): (["bullish" | "bearish", number, number] | null)[] {
  const result: (["bullish" | "bearish", number, number] | null)[] = Array(candles.length).fill(null);

  const bodySizes = candles.map((c) => Math.abs(c.close - c.open));
  const avgBodySize = bodySizes.reduce((a, b) => a + b, 0) / bodySizes.length || 0.001;

  for (let i = 2; i < candles.length; i++) {
    const firstHigh = candles[i - 2].high;
    const firstLow = candles[i - 2].low;

    const middleOpen = candles[i - 1].open;
    const middleClose = candles[i - 1].close;
    const middleBody = Math.abs(middleClose - middleOpen);

    const thirdHigh = candles[i].high;
    const thirdLow = candles[i].low;

    if (thirdLow > firstHigh && middleBody > avgBodySize * bodyMultiplier) {
      result[i] = ["bullish", firstHigh, thirdLow];
    } else if (thirdHigh < firstLow && middleBody > avgBodySize * bodyMultiplier) {
      result[i] = ["bearish", firstLow, thirdHigh];
    }
  }

  return result;
}

export function buildFvgResults(instId: string, candles: Candle[], fvgList: (["bullish" | "bearish", number, number] | null)[], volRank: number): FvgResult[] {
  const results: FvgResult[] = [];

  for (let idx = 0; idx < fvgList.length; idx++) {
    const fvg = fvgList[idx];
    if (!fvg) continue;

    const [fvgType, level1, level2] = fvg;
    let fvgDate: Date;
    let displayedCandleIdx: number;

    if (fvgType === "bullish") {
      fvgDate = candles[idx].date;
      displayedCandleIdx = idx;
    } else {
      fvgDate = candles[idx - 1].date;
      displayedCandleIdx = idx - 1;
    }

    const mid = (level1 + level2) / 2;
    const gapPercentage = mid !== 0 ? (Math.abs(level1 - level2) / mid) * 100 : 0;

    results.push({
      instId,
      fvgDate,
      fvgType,
      level1,
      level2,
      gapPercentage,
      candleIdx: displayedCandleIdx,
      volRank,
    });
  }

  return results;
}

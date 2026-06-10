import type { Candle } from "./fvg";

const OKX_BASE = "https://www.okx.com";

export interface Ticker {
  instId: string;
  last: string;
  vol24h: string;
  volCcy24h: string;
  volRank: number;
  score: number;
}

export async function fetchUsdtSpotPairs(): Promise<Ticker[]> {
  const res = await fetch(`${OKX_BASE}/api/v5/market/tickers?instType=SPOT`);
  const data = await res.json();
  const all: Ticker[] = data.data ?? [];
  const usdt = all.filter((t) => t.instId.endsWith("-USDT"));

  // Score = price × vol24h_USDT (same formula as Python reference)
  usdt.forEach((t) => {
    const price = parseFloat(t.last) || 0;
    const vol24 = parseFloat(t.volCcy24h) || 0;
    t.score = price * vol24;
  });

  // Sort by score descending and assign rank
  usdt.sort((a, b) => b.score - a.score);
  usdt.forEach((t, i) => { t.volRank = i + 1; });

  return usdt;
}

export async function fetchCandles(instId: string, bar = "1D", limit = 20): Promise<Candle[] | null> {
  try {
    const res = await fetch(
      `${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`
    );
    const data = await res.json();
    if (data.code !== "0" || !data.data?.length) return null;

    const candles: Candle[] = data.data
      .map((row: string[]) => {
        const [ts, open, high, low, close, , , , confirm] = row;
        if (parseInt(confirm) !== 1) return null;
        return {
          date: new Date(parseInt(ts)),
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          vol: 0,
        } as Candle;
      })
      .filter(Boolean) as Candle[];

    candles.sort((a, b) => a.date.getTime() - b.date.getTime());
    return candles.length >= 3 ? candles : null;
  } catch {
    return null;
  }
}

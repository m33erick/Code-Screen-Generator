import type { Candle } from "./fvg";

const OKX_BASE = "https://www.okx.com";

export interface Ticker {
  instId: string;
  last: string;
  vol24h: string;
}

export async function fetchUsdtSpotPairs(): Promise<Ticker[]> {
  const res = await fetch(`${OKX_BASE}/api/v5/market/tickers?instType=SPOT`);
  const data = await res.json();
  const all: Ticker[] = data.data ?? [];
  return all.filter((t) => t.instId.endsWith("-USDT"));
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

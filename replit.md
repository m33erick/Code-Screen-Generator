# FVG Screener

Screener de Fair Value Gaps (FVG) sur toutes les paires USDT SPOT OKX — détection en temps réel sur les bougies journalières.

## Run & Operate

- `pnpm --filter @workspace/fvg-screener run dev` — run the screener frontend (port from ENV)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter
- Data: OKX public API (no auth required)
- Build: esbuild (CJS bundle for API), Vite (frontend)

## Where things live

- `artifacts/fvg-screener/src/lib/fvg.ts` — FVG detection algorithm (port of Python logic)
- `artifacts/fvg-screener/src/lib/okx.ts` — OKX API client
- `artifacts/fvg-screener/src/pages/Screener.tsx` — Main screener UI
- `lib/api-spec/openapi.yaml` — API spec (health only for now)

## Architecture decisions

- FVG detection runs entirely client-side in the browser — no backend needed since OKX API is public and supports CORS
- Pairs are fetched in batches of 5 to avoid rate-limiting
- Only confirmed candles (confirm=1) are used, matching the original Python behavior
- Results are sortable and filterable by type, pair name, and minimum gap %

## Product

- Fetches all USDT SPOT pairs from OKX (~500+ pairs)
- Downloads 20 daily candles per pair
- Detects Bullish and Bearish FVGs using body_multiplier=1.5
- Displays results with TradingView chart links
- Filterable by type (bullish/bearish), pair name search, minimum gap %
- Sortable columns: date, pair, type, gap %

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- OKX API has rate limits — scanning all pairs takes 1-2 minutes
- CORS is supported for OKX public market data endpoints
- The `stop` button sets an abort flag but in-flight batch requests still complete

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

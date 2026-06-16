import { useState, useCallback, useRef } from "react";
import { fetchUsdtSpotPairs, fetchCandles } from "@/lib/okx";
import { detectFvg, buildFvgResults, type FvgResult } from "@/lib/fvg";

type SortKey = "fvgDate" | "instId" | "fvgType" | "gapPercentage" | "volRank";
type SortDir = "asc" | "desc";
type FilterType = "all" | "bullish" | "bearish";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.001) return n.toFixed(6);
  return n.toFixed(8);
}

function getTvUrl(instId: string): string {
  const sym = instId.replace(/-/g, "");
  return `https://www.tradingview.com/chart/?aff_id=161811&symbol=OKX%3A${sym}`;
}

export default function Screener() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, fvgCount: 0 });
  const [results, setResults] = useState<FvgResult[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortKey, setSortKey] = useState<SortKey>("fvgDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minGap, setMinGap] = useState("");
  const [maxRank, setMaxRank] = useState("");
  const abortRef = useRef(false);

  const run = useCallback(async () => {
    setStatus("running");
    setResults([]);
    abortRef.current = false;

    try {
      const tickers = await fetchUsdtSpotPairs();
      setProgress({ current: 0, total: tickers.length, fvgCount: 0 });

      const allResults: FvgResult[] = [];
      const BATCH = 5;

      for (let i = 0; i < tickers.length; i += BATCH) {
        if (abortRef.current) break;
        const batch = tickers.slice(i, i + BATCH);

        await Promise.all(
          batch.map(async (ticker) => {
            const candles = await fetchCandles(ticker.instId);
            if (!candles) return;
            const fvgList = detectFvg(candles, 1.5);
            const found = buildFvgResults(ticker.instId, candles, fvgList, ticker.volRank);
            if (found.length > 0) allResults.push(...found);
          })
        );

        setProgress((p) => ({
          current: Math.min(i + BATCH, tickers.length),
          total: tickers.length,
          fvgCount: allResults.length,
        }));
      }

      allResults.sort((a, b) => b.fvgDate.getTime() - a.fvgDate.getTime() || a.instId.localeCompare(b.instId));
      setResults(allResults);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    setStatus("done");
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const minGapNum = parseFloat(minGap) || 0;
  const maxRankNum = parseInt(maxRank) || 0;

  const filtered = results
    .filter((r) => {
      if (filterType !== "all" && r.fvgType !== filterType) return false;
      if (search && !r.instId.toLowerCase().includes(search.toLowerCase())) return false;
      if (minGapNum > 0 && r.gapPercentage < minGapNum) return false;
      if (maxRankNum > 0 && r.volRank > maxRankNum) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fvgDate") cmp = a.fvgDate.getTime() - b.fvgDate.getTime();
      else if (sortKey === "instId") cmp = a.instId.localeCompare(b.instId);
      else if (sortKey === "fvgType") cmp = a.fvgType.localeCompare(b.fvgType);
      else if (sortKey === "gapPercentage") cmp = a.gapPercentage - b.gapPercentage;
      else if (sortKey === "volRank") cmp = a.volRank - b.volRank;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-blue-300">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : (
      <span className="ml-1 text-slate-500">↕</span>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 16l4-4 4 4 4-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Screener FVG Crypto – Fair Value Gap &amp; Smart Money</h1>
              <p className="text-xs text-slate-400">Fair Value Gaps — OKX USDT SPOT · 1D</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {status === "running" ? (
              <button
                onClick={stop}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors w-full sm:w-auto"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={run}
                disabled={status === "running"}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 w-full sm:w-auto"
              >
                {status === "idle" ? "Run Screener" : "Run Again"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        {status === "running" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Scanning pairs…</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-6 text-xs">
              <span className="text-slate-400">Progress <span className="text-white font-bold">{pct}%</span></span>
              <span className="text-slate-400">FVGs found <span className="text-green-400 font-bold">{progress.fvgCount}</span></span>
            </div>
          </div>
        )}

        {/* Stats */}
        {(status === "done" || results.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total FVGs", value: results.length, color: "text-white" },
              { label: "Bullish", value: results.filter((r) => r.fvgType === "bullish").length, color: "text-green-400" },
              { label: "Bearish", value: results.filter((r) => r.fvgType === "bearish").length, color: "text-red-400" },
              { label: "Pairs", value: new Set(results.map((r) => r.instId)).size, color: "text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        {results.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="search"
              placeholder="Search pair…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              {(["all", "bullish", "bearish"] as FilterType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    filterType === t
                      ? t === "bullish"
                        ? "bg-green-600 border-green-500 text-white"
                        : t === "bearish"
                        ? "bg-red-600 border-red-500 text-white"
                        : "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Min Gap %"
              value={minGap}
              onChange={(e) => setMinGap(e.target.value)}
              className="w-28 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              min="0"
              step="0.1"
            />
            <input
              type="number"
              placeholder="Top N rank"
              value={maxRank}
              onChange={(e) => setMaxRank(e.target.value)}
              title="Afficher uniquement les FVGs dont le Score Rank est ≤ N (ex: 50 = top 50)"
              className="w-28 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              min="1"
              step="1"
            />
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    {[
                      { label: "Score Rank", key: "volRank" as SortKey, title: "Rang par score = Prix × Volume 24h USDT (inspiré du classement Python)" },
                      { label: "Instrument", key: "instId" as SortKey, title: undefined },
                      { label: "Type", key: "fvgType" as SortKey, title: undefined },
                      { label: "Date", key: "fvgDate" as SortKey, title: undefined },
                      { label: "Level 1", key: null, title: undefined },
                      { label: "Level 2", key: null, title: undefined },
                      { label: "Gap %", key: "gapPercentage" as SortKey, title: undefined },
                      { label: "Chart", key: null, title: undefined },
                    ].map((col) => (
                      <th
                        key={col.label}
                        title={col.title}
                        className={`px-4 py-3 text-left whitespace-nowrap ${col.key ? "cursor-pointer hover:text-white select-none" : ""}`}
                        onClick={() => col.key && toggleSort(col.key)}
                      >
                        {col.label}
                        {col.key && <SortIcon k={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtered.map((r, i) => (
                    <tr
                      key={`${r.instId}-${r.fvgDate.getTime()}-${i}`}
                      className="hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-center" title="Rang score = Prix × Vol24h USDT (1 = meilleur score)">
                        <span className={`inline-block font-mono font-semibold text-xs px-2 py-0.5 rounded ${
                          r.volRank <= 10
                            ? "bg-yellow-900/50 text-yellow-300 border border-yellow-700"
                            : r.volRank <= 50
                            ? "bg-slate-700 text-slate-200 border border-slate-600"
                            : "text-slate-500"
                        }`}>
                          #{r.volRank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white whitespace-nowrap">
                        {r.instId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            r.fvgType === "bullish"
                              ? "bg-green-900/50 text-green-400 border border-green-800"
                              : "bg-red-900/50 text-red-400 border border-red-800"
                          }`}
                        >
                          {r.fvgType === "bullish" ? "▲" : "▼"} {r.fvgType.charAt(0).toUpperCase() + r.fvgType.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(r.fvgDate)}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono">{formatPrice(r.level1)}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono">{formatPrice(r.level2)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-mono font-semibold ${
                            r.gapPercentage > 5
                              ? "text-yellow-400"
                              : r.gapPercentage > 2
                              ? "text-blue-400"
                              : "text-slate-300"
                          }`}
                        >
                          {r.gapPercentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={getTvUrl(r.instId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-800 hover:border-blue-600 px-2 py-1 rounded"
                        >
                          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                            <path d="M14 3h7v7l-2-2-7 7-4-4-6 6-1.5-1.5 7.5-7.5 4 4 5.5-5.5L14 3z" />
                          </svg>
                          Chart
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-500">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} {results.length !== filtered.length && `(filtered from ${results.length})`}
            </div>
          </div>
        )}

        {/* Empty states */}
        {status === "idle" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-900/30 border border-blue-800 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-blue-400" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 16l4-4 4 4 4-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Prêt à scanner</p>
              <p className="text-slate-500 text-sm mt-1">
                Clique sur <strong className="text-slate-300">Run Screener</strong> pour analyser toutes les paires USDT SPOT OKX et détecter les Fair Value Gaps sur les 20 dernières bougies journalières.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500 pt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Bullish FVG : Low[3] &gt; High[1]</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Bearish FVG : High[3] &lt; Low[1]</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Corps médian &gt; 1.5× moyenne</span>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-xl border border-red-800 bg-red-900/20 p-8 text-center">
            <p className="text-red-400 font-semibold">Erreur lors du scan</p>
            <p className="text-slate-400 text-sm mt-1">Vérifie ta connexion et réessaie.</p>
            <button onClick={run} className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {status === "done" && filtered.length === 0 && results.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">Aucun FVG détecté.</p>
          </div>
        )}

        {status === "done" && filtered.length === 0 && results.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">Aucun résultat ne correspond aux filtres.</p>
            <button
              onClick={() => { setSearch(""); setFilterType("all"); setMinGap(""); setMaxRank(""); }}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* SEO Content Section */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-5 text-sm text-slate-400 leading-relaxed">
          <div>
            <h2 className="text-base font-semibold text-white mb-2">Screener FVG Crypto – Fair Value Gap en Temps Réel</h2>
            <p>
              Ce screener FVG crypto est conçu pour identifier rapidement les{" "}
              <strong className="text-slate-200">Fair Value Gaps (FVG)</strong> sur les principales cryptomonnaies.
              Il s'adresse aux traders utilisant les concepts{" "}
              <em>Smart Money</em> et <em>ICT</em>, cherchant des zones de déséquilibre
              de prix exploitables sur les marchés crypto.
            </p>
            <p className="mt-3">
              Contrairement à un classement basé uniquement sur la market cap,
              ce screener analyse les cryptos selon un{" "}
              <strong className="text-slate-200">rang relatif combinant prix, volume et dynamique de marché</strong>.
              Cela permet de faire ressortir les actifs les plus actifs,
              souvent précurseurs de la formation ou du comblement de FVG.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Qu'est-ce qu'un Fair Value Gap (FVG) en crypto ?</h3>
            <p>
              Un Fair Value Gap correspond à une zone où le prix s'est déplacé
              de manière impulsive, laissant un déséquilibre entre acheteurs et vendeurs.
              En trading crypto, les FVG sont souvent revisités par le marché,
              offrant des opportunités d'entrée à forte probabilité.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Pourquoi utiliser un screener FVG crypto ?</h3>
            <ul className="space-y-1.5 list-none">
              {[
                "Identifier rapidement les cryptos présentant des déséquilibres de prix",
                "Gagner du temps sans scanner manuellement chaque graphique",
                "Repérer les actifs alignés avec une logique Smart Money",
                "Compléter une stratégie de trading ICT ou price action",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              Ce screener FVG crypto est mis à jour régulièrement afin de fournir
              une vision claire et exploitable du marché.
              Il constitue un outil complémentaire idéal pour les traders
              souhaitant structurer leur analyse avant de passer sur les graphiques.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-5 text-sm text-slate-400 leading-relaxed">
          <h2 className="text-base font-semibold text-white">FAQ – Screener FVG Crypto</h2>

          <div className="space-y-4">
            {[
              {
                q: "Qu'est-ce qu'un screener FVG crypto ?",
                a: "Un screener FVG crypto est un outil permettant d'identifier rapidement les Fair Value Gaps sur les cryptomonnaies, sans analyser chaque graphique manuellement.",
              },
              {
                q: "Le screener FVG est-il basé sur la market cap ?",
                a: "Non. Ce screener utilise un rang relatif combinant prix et volume, plus pertinent pour détecter l'activité institutionnelle.",
              },
              {
                q: "À qui s'adresse un screener FVG crypto ?",
                a: "Aux traders utilisant les concepts Smart Money, ICT ou price action avancée sur les marchés crypto.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-t border-slate-800 pt-4 first:border-0 first:pt-0">
                <h3 className="text-sm font-semibold text-white mb-1">{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pb-4">
          Données : OKX API publique · Détection : body_multiplier=1.5 · Timeframe : 1D · Bougies confirmées uniquement
        </div>
      </div>
    </div>
  );
}

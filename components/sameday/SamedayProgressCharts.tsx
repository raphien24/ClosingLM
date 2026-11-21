"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SamedayHubRow, SamedayPeriodColumn } from "@/lib/samedayService";
import { BarChart3, LineChart, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

interface SamedayProgressChartsProps {
  rows: SamedayHubRow[];
  deliveredDailyCols: SamedayPeriodColumn[];
  onSelectHub?: (row: SamedayHubRow) => void;
}

type TrendGranularity = "daily" | "weekly";
type HubRankMode = "lowest" | "highest";

interface TrendPoint {
  label: string;
  delivered: number | null;
}

function avgNums(nums: (number | null)[]): number | null {
  const valid = nums.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

function fmtPct(v: number | null): string {
  if (v === null) return "-";
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`;
}

export function SamedayProgressCharts({
  rows,
  deliveredDailyCols,
  onSelectHub,
}: SamedayProgressChartsProps) {
  const [granularity, setGranularity] = useState<TrendGranularity>("daily");
  const [rankMode, setRankMode] = useState<HubRankMode>("lowest");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState<{ width: number; height: number }>({
    width: 880,
    height: 290,
  });

  useEffect(() => {
    const el = chartBoxRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.max(360, Math.round(rect.width));
      const nextH = Math.max(240, Math.round(rect.height));
      setChartSize((prev) =>
        prev.width === nextW && prev.height === nextH
          ? prev
          : { width: nextW, height: nextH }
      );
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const avgTargetDelivered = useMemo(
    () => avgNums(rows.map((r) => r.targetDelivered)),
    [rows]
  );

  // Data titik tren SD Delivered (kronologis dari kiri/lama ke kanan/terbaru)
  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (rows.length === 0) return [];
    if (granularity === "weekly") {
      const stages: { label: string; getDelvd: (r: SamedayHubRow) => number | null }[] = [
        { label: "L1M", getDelvd: (r) => r.delivered.l1m },
        { label: "L3W", getDelvd: (r) => r.delivered.l3w },
        { label: "L2W", getDelvd: (r) => r.delivered.l2w },
        { label: "L1W", getDelvd: (r) => r.delivered.l1w },
        { label: "WTD", getDelvd: (r) => r.delivered.wtd },
        { label: "MTD", getDelvd: (r) => r.delivered.mtd },
      ];
      return stages.map((st) => ({
        label: st.label,
        delivered: avgNums(rows.map(st.getDelvd)),
      }));
    }

    const dayCount = deliveredDailyCols.length;
    const pts: TrendPoint[] = [];
    // Sheet STD SD meletakkan tanggal terbaru di kiri (idx 0) -> balik urutan jadi kronologis
    for (let i = dayCount - 1; i >= 0; i--) {
      const label = deliveredDailyCols[i]?.label || `H-${i + 1}`;
      pts.push({
        label,
        delivered: avgNums(rows.map((r) => r.delivered.daily[i] ?? null)),
      });
    }
    return pts;
  }, [rows, granularity, deliveredDailyCols]);

  // Skala sumbu Y otomatis khusus SD Delivered agar variasi terlihat jelas
  const { yMin, yMax } = useMemo(() => {
    const allVals: number[] = [];
    trendPoints.forEach((p) => {
      if (p.delivered !== null) allVals.push(p.delivered);
    });
    if (avgTargetDelivered !== null) allVals.push(avgTargetDelivered);
    if (allVals.length === 0) return { yMin: 80, yMax: 100 };
    const rawMin = Math.min(...allVals);
    const paddedMin = Math.max(0, Math.floor((rawMin - 2) / 2) * 2);
    return { yMin: Math.min(paddedMin, 94), yMax: 100 };
  }, [trendPoints, avgTargetDelivered]);

  // Distribusi kepatuhan target Delivered MTD & ranking Hub
  const { statusStats, rankedHubs } = useMemo(() => {
    let onTarget = 0;
    let nearTarget = 0;
    let belowTarget = 0;

    for (const r of rows) {
      const val = r.delivered.mtd;
      const tgt = r.targetDelivered;
      if (val === null || tgt === null) continue;
      if (val >= tgt) onTarget++;
      else if (val >= tgt - 2) nearTarget++;
      else belowTarget++;
    }

    const withGap = rows
      .filter((r) => r.delivered.mtd !== null && r.targetDelivered !== null)
      .map((r) => ({
        row: r,
        mtd: r.delivered.mtd!,
        target: r.targetDelivered!,
        gap: r.delivered.mtd! - r.targetDelivered!,
      }));

    withGap.sort((a, b) =>
      rankMode === "lowest" ? a.gap - b.gap || a.mtd - b.mtd : b.gap - a.gap || b.mtd - a.mtd
    );

    return {
      statusStats: {
        onTarget,
        nearTarget,
        belowTarget,
        totalEvaluated: onTarget + nearTarget + belowTarget,
      },
      rankedHubs: withGap.slice(0, 6),
    };
  }, [rows, rankMode]);

  // Geometri SVG Line/Area Chart mengikuti ukuran riil kontainer (1:1 CSS px, bebas ruang kosong)
  const svgW = chartSize.width;
  const svgH = chartSize.height;
  const padL = 44;
  const padR = 26;
  const padT = 26;
  const padB = 30;
  const plotW = Math.max(120, svgW - padL - padR);
  const plotH = Math.max(100, svgH - padT - padB);

  const getX = (idx: number) => {
    if (trendPoints.length <= 1) return padL + plotW / 2;
    return padL + (idx / (trendPoints.length - 1)) * plotW;
  };
  const getY = (val: number) => {
    const span = Math.max(1, yMax - yMin);
    const ratio = Math.max(0, Math.min(1, (val - yMin) / span));
    return padT + plotH * (1 - ratio);
  };

  const buildPaths = (getter: (p: TrendPoint) => number | null) => {
    const valid = trendPoints
      .map((p, idx) => ({ idx, val: getter(p) }))
      .filter((x): x is { idx: number; val: number } => x.val !== null);
    if (valid.length === 0) return { line: "", area: "", dots: [] as { x: number; y: number; val: number; idx: number }[] };

    const dots = valid.map((pt) => ({
      x: getX(pt.idx),
      y: getY(pt.val),
      val: pt.val,
      idx: pt.idx,
    }));

    const line = dots.map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" ");
    const baseY = padT + plotH;
    const area = `${line} L${dots[dots.length - 1].x.toFixed(1)},${baseY} L${dots[0].x.toFixed(1)},${baseY} Z`;
    return { line, area, dots };
  };

  const delvdSeries = buildPaths((p) => p.delivered);

  const yTicks = useMemo(() => {
    const count = 4;
    const step = (yMax - yMin) / count;
    return Array.from({ length: count + 1 }, (_, i) => Math.round((yMin + i * step) * 10) / 10);
  }, [yMin, yMax]);

  const activePoint =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < trendPoints.length
      ? trendPoints[hoverIdx]
      : null;
  const displayPoint =
    activePoint ??
    (trendPoints.length > 0 ? trendPoints[trendPoints.length - 1] : null);
  const isShowingHover = activePoint !== null;

  // Donut arc helper
  const donutRadius = 36;
  const donutCirc = 2 * Math.PI * donutRadius;
  const evalTotal = Math.max(1, statusStats.totalEvaluated);
  const onFrac = statusStats.onTarget / evalTotal;
  const nearFrac = statusStats.nearTarget / evalTotal;
  const belowFrac = statusStats.belowTarget / evalTotal;

  const scopeLabel =
    rows.length === 1 ? rows[0].namaHub : `Rata-rata ${rows.length} Hub Terfilter`;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
      {/* Chart 1 (2/3 width): Tren Progres Harian / Mingguan SD Delivering & Delivered */}
      <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-sky-600 dark:border-t-sky-500 shadow-sm p-5 flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Grafik Progres STD ({granularity === "daily" ? "14 Hari Terakhir" : "L1M → MTD"})
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {scopeLabel} · Perbandingan SD Delivered terhadap target
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => {
                setGranularity("daily");
                setHoverIdx(null);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                granularity === "daily"
                  ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              14 Hari
            </button>
            <button
              type="button"
              onClick={() => {
                setGranularity("weekly");
                setHoverIdx(null);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                granularity === "weekly"
                  ? "bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-2xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Mingguan
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold mb-2">
          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            SD Delivered
          </span>
          {avgTargetDelivered !== null && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
              <span className="w-4 border-t-2 border-dashed border-emerald-400" />
              Target Delivered ({fmtPct(avgTargetDelivered)})
            </span>
          )}
        </div>

        {/* Responsive Full-Bleed SVG Chart */}
        <div
          ref={chartBoxRef}
          className="relative w-full flex-1 min-h-[250px]"
        >
          {trendPoints.length === 0 ? (
            <div className="h-full min-h-[250px] flex items-center justify-center text-xs text-slate-400">
              Tidak ada data tren untuk ditampilkan.
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="absolute inset-0 w-full h-full block overflow-visible select-none"
              onMouseLeave={() => setHoverIdx(null)}
            >
              <defs>
                <linearGradient id="sdDelvdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.26" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Y Grid & Labels */}
              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-700/70"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 7}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-400 tabular-nums"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {/* Reference Target Line */}
              {avgTargetDelivered !== null && avgTargetDelivered >= yMin && avgTargetDelivered <= yMax && (
                <line
                  x1={padL}
                  y1={getY(avgTargetDelivered)}
                  x2={svgW - padR}
                  y2={getY(avgTargetDelivered)}
                  stroke="#34d399"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                  opacity="0.9"
                />
              )}

              {/* Area Fill */}
              {delvdSeries.area && <path d={delvdSeries.area} fill="url(#sdDelvdGrad)" />}

              {/* Line */}
              {delvdSeries.line && (
                <path
                  d={delvdSeries.line}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Vertical Hover Crosshair */}
              {hoverIdx !== null && (
                <line
                  x1={getX(hoverIdx)}
                  y1={padT}
                  x2={getX(hoverIdx)}
                  y2={padT + plotH}
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data Points + Value Labels */}
              {delvdSeries.dots.map((d) => {
                const isHovered = hoverIdx === d.idx;
                return (
                  <g key={`dlvd-${d.idx}`}>
                    <circle
                      cx={d.x}
                      cy={d.y}
                      r={isHovered ? 5.5 : 3.6}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                    <text
                      x={d.x}
                      y={d.y - 10}
                      textAnchor="middle"
                      style={{ paintOrder: "stroke" }}
                      className={`text-[10px] tabular-nums stroke-[3px] stroke-white dark:stroke-slate-900 pointer-events-none ${
                        isHovered
                          ? "font-extrabold fill-amber-600 dark:fill-amber-300"
                          : "font-bold fill-emerald-700 dark:fill-emerald-300"
                      }`}
                    >
                      {fmtPct(d.val)}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Labels & Interactive Hover Columns */}
              {trendPoints.map((pt, idx) => {
                const x = getX(idx);
                const showLabel =
                  granularity === "weekly" ||
                  trendPoints.length <= 8 ||
                  idx % 2 === 0 ||
                  idx === trendPoints.length - 1;
                const colW = plotW / Math.max(1, trendPoints.length);
                return (
                  <g key={`${pt.label}-${idx}`}>
                    {showLabel && (
                      <text
                        x={x}
                        y={svgH - 10}
                        textAnchor="middle"
                        className={`text-[10px] font-semibold tabular-nums ${
                          hoverIdx === idx
                            ? "fill-amber-600 dark:fill-amber-300 font-bold"
                            : "fill-slate-500 dark:fill-slate-400"
                        }`}
                      >
                        {pt.label}
                      </text>
                    )}
                    <rect
                      x={x - colW / 2}
                      y={padT}
                      width={colW}
                      height={plotH + 22}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoverIdx(idx)}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* Telemetry / Hover Info Strip */}
        </div>
        {displayPoint && (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-950 text-white text-xs flex flex-wrap items-center justify-between gap-3 border border-slate-700/90 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-amber-300">{displayPoint.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {isShowingHover ? "Dipilih" : "Terbaru · Arahkan kursor ke grafik"}
              </span>
            </div>
            <div className="flex items-center gap-4 tabular-nums">
              <span>
                Delivered:{" "}
                <strong className="text-emerald-300">{fmtPct(displayPoint.delivered)}</strong>
              </span>
              {avgTargetDelivered !== null && (
                <span className="text-slate-300">
                  Target:{" "}
                  <strong className="text-amber-300">{fmtPct(avgTargetDelivered)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chart 2 (1/3 width): Donut Kepatuhan Target & Progres per Hub */}
      <div className="bg-white rounded-2xl border border-slate-300/75 dark:border-slate-700/80 border-t-[3px] border-t-emerald-600 dark:border-t-emerald-500 shadow-sm p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Status Target &amp; Ranking Hub
              </h2>
            </div>
          </div>

          {/* Donut Gauge */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-slate-900/65 border border-slate-200/80 dark:border-slate-700/70">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90">
                <circle
                  cx="46"
                  cy="46"
                  r={donutRadius}
                  fill="none"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                  strokeWidth="10"
                />
                {statusStats.onTarget > 0 && (
                  <circle
                    cx="46"
                    cy="46"
                    r={donutRadius}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray={`${onFrac * donutCirc} ${donutCirc}`}
                    strokeDashoffset={0}
                  />
                )}
                {statusStats.nearTarget > 0 && (
                  <circle
                    cx="46"
                    cy="46"
                    r={donutRadius}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="10"
                    strokeDasharray={`${nearFrac * donutCirc} ${donutCirc}`}
                    strokeDashoffset={-(onFrac * donutCirc)}
                  />
                )}
                {statusStats.belowTarget > 0 && (
                  <circle
                    cx="46"
                    cy="46"
                    r={donutRadius}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="10"
                    strokeDasharray={`${belowFrac * donutCirc} ${donutCirc}`}
                    strokeDashoffset={-((onFrac + nearFrac) * donutCirc)}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
                  {statusStats.totalEvaluated > 0
                    ? `${Math.round(onFrac * 100)}%`
                    : "-"}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  On Target
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  On Target
                </span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {statusStats.onTarget} hub
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Mendekati (-2%)
                </span>
                <span className="font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                  {statusStats.nearTarget} hub
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Below Target
                </span>
                <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                  {statusStats.belowTarget} hub
                </span>
              </div>
            </div>
          </div>

          {/* Hub Progress Bar Ranking */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                {rankMode === "lowest" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
                Delivered MTD vs Target
              </span>
              <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setRankMode("lowest")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                    rankMode === "lowest"
                      ? "bg-white dark:bg-amber-600 text-amber-700 dark:text-white shadow-2xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Terendah
                </button>
                <button
                  type="button"
                  onClick={() => setRankMode("highest")}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                    rankMode === "highest"
                      ? "bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-2xs"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Tertinggi
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {rankedHubs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada data.</p>
              ) : (
                rankedHubs.map(({ row, mtd, target, gap }) => {
                  const barPct = Math.max(0, Math.min(100, ((mtd - 75) / 25) * 100));
                  const targetMarkerPct = Math.max(0, Math.min(100, ((target - 75) / 25) * 100));
                  const barColor =
                    gap >= 0 ? "bg-emerald-500" : gap >= -2 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <button
                      key={row.namaHub}
                      type="button"
                      onClick={() => onSelectHub?.(row)}
                      title={`Klik untuk detail ${row.namaHub}`}
                      className="w-full text-left group rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-sky-300">
                          {row.namaHub}
                        </span>
                        <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {fmtPct(mtd)}{" "}
                          <span className="text-[10px] font-semibold text-slate-400">
                            / {fmtPct(target)}
                          </span>
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${barPct}%` }}
                        />
                        <div
                          className="absolute -top-0.5 -bottom-0.5 w-[2px] bg-slate-900 dark:bg-white rounded-full opacity-75"
                          style={{ left: `${targetMarkerPct}%` }}
                          title={`Target: ${fmtPct(target)}`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
          <TrendingUp className="h-3 w-3 flex-shrink-0" />
          Garis tegak pada bar menandai target SD Delivered masing-masing Hub.
        </p>
      </div>
    </div>
  );
}

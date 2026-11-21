import { ImageResponse } from "next/og";
import type { MonitorSamedayData } from "./samedayService";

function avgNums(nums: (number | null)[]): number | null {
  const valid = nums.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

function fmtPct(v: number | null, decimalsIfFloat = 1): string {
  if (v === null) return "-";
  return Number.isInteger(v) ? `${v}%` : `${v.toFixed(decimalsIfFloat)}%`;
}

export interface StdStatusStats {
  onTarget: number;
  nearTarget: number;
  belowTarget: number;
  totalEvaluated: number;
}

export function computeStdStatusAndRanking(data: MonitorSamedayData) {
  let onTarget = 0;
  let nearTarget = 0;
  let belowTarget = 0;

  for (const r of data.rows) {
    const val = r.delivered.mtd;
    const tgt = r.targetDelivered;
    if (val === null || tgt === null) continue;
    if (val >= tgt) onTarget++;
    else if (val >= tgt - 2) nearTarget++;
    else belowTarget++;
  }

  const withGap = data.rows
    .filter((r) => r.delivered.mtd !== null && r.targetDelivered !== null)
    .map((r) => ({
      row: r,
      mtd: r.delivered.mtd!,
      target: r.targetDelivered!,
      gap: Math.round((r.delivered.mtd! - r.targetDelivered!) * 10) / 10,
    }));

  const lowestFirst = [...withGap].sort((a, b) => a.gap - b.gap || a.mtd - b.mtd);
  const notOnTarget = lowestFirst.filter((item) => item.gap < 0);

  return {
    statusStats: {
      onTarget,
      nearTarget,
      belowTarget,
      totalEvaluated: onTarget + nearTarget + belowTarget,
    } as StdStatusStats,
    lowestRanked: lowestFirst.slice(0, 6),
    notOnTarget,
  };
}

/**
 * Render gambar PNG laporan Monitor STD (tampilan 4 KPI + Grafik 14 Hari berlabel value + Donut Status & Ranking Hub)
 * menggunakan Next.js ImageResponse.
 */
export async function generateStdMonitorImageBase64(
  data: MonitorSamedayData
): Promise<{ base64: string; width: number; height: number }> {
  const width = 1180;
  const height = 640;

  const { statusStats, lowestRanked } = computeStdStatusAndRanking(data);
  const avgTargetDelivered = avgNums(data.rows.map((r) => r.targetDelivered));

  // Titik tren kronologis 14 hari terakhir
  const dayCount = data.deliveredDailyCols.length;
  const trendPoints: { label: string; delivered: number | null }[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const label = data.deliveredDailyCols[i]?.label || `H-${i + 1}`;
    trendPoints.push({
      label,
      delivered: avgNums(data.rows.map((r) => r.delivered.daily[i] ?? null)),
    });
  }

  // Skala Y otomatis agar tren jelas
  const allVals: number[] = [];
  for (const p of trendPoints) {
    if (p.delivered !== null) allVals.push(p.delivered);
  }
  if (avgTargetDelivered !== null) allVals.push(avgTargetDelivered);
  let yMin = 80;
  const yMax = 100;
  if (allVals.length > 0) {
    const rawMin = Math.min(...allVals);
    const paddedMin = Math.max(0, Math.floor((rawMin - 2) / 2) * 2);
    yMin = Math.min(paddedMin, 94);
  }
  const yTicks = Array.from({ length: 5 }, (_, i) =>
    Math.round((yMin + ((yMax - yMin) / 4) * i) * 10) / 10
  );

  // Geometri SVG Chart Kiri
  const svgW = 700;
  const svgH = 290;
  const padL = 46;
  const padR = 26;
  const padT = 26;
  const padB = 32;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getX = (idx: number) =>
    trendPoints.length <= 1 ? padL + plotW / 2 : padL + (idx / (trendPoints.length - 1)) * plotW;
  const getY = (val: number) => {
    const span = Math.max(1, yMax - yMin);
    const ratio = Math.max(0, Math.min(1, (val - yMin) / span));
    return padT + plotH * (1 - ratio);
  };

  const validDots = trendPoints
    .map((p, idx) => ({ idx, val: p.delivered }))
    .filter((pt): pt is { idx: number; val: number } => pt.val !== null)
    .map((pt) => ({
      idx: pt.idx,
      val: pt.val,
      x: getX(pt.idx),
      y: getY(pt.val),
    }));

  const linePath = validDots
    .map((d, i) => `${i === 0 ? "M" : "L"}${d.x.toFixed(1)},${d.y.toFixed(1)}`)
    .join(" ");
  const baseY = padT + plotH;
  const areaPath =
    validDots.length > 0
      ? `${linePath} L${validDots[validDots.length - 1].x.toFixed(1)},${baseY} L${validDots[0].x.toFixed(1)},${baseY} Z`
      : "";

  // Donut Ring SVG Kanan
  const donutRadius = 32;
  const donutCirc = 2 * Math.PI * donutRadius;
  const evalTotal = Math.max(1, statusStats.totalEvaluated);
  const onFrac = statusStats.onTarget / evalTotal;
  const nearFrac = statusStats.nearTarget / evalTotal;
  const belowFrac = statusStats.belowTarget / evalTotal;
  const onPctText =
    statusStats.totalEvaluated > 0 ? `${Math.round(onFrac * 100)}%` : "-";

  const tierSummary = Object.entries(data.summary.tierCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tier, cnt]) => `Tier ${tier}: ${cnt}`)
    .join(" · ");

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#eef4fa",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Accent */}
        <div
          style={{
            width: "100%",
            height: 6,
            backgroundColor: "#0284c7",
            display: "flex",
          }}
        />

        {/* Header Banner */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 24px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "#e0f2fe",
                border: "2px solid #7dd3fc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
                fontSize: 14,
                fontWeight: 800,
                color: "#0369a1",
              }}
            >
              STD
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                  }}
                >
                  MONITOR STD — SAMEDAY REPORT JTT08
                </div>
                <div
                  style={{
                    marginLeft: 10,
                    padding: "2px 10px",
                    borderRadius: 999,
                    backgroundColor: "#e0f2fe",
                    border: "1px solid #bae6fd",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#0369a1",
                    display: "flex",
                  }}
                >
                  STD SD · Hub SD
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  fontSize: 12,
                  color: "#475569",
                }}
              >
                <span>{`CL: ${data.clEmail}`}</span>
                <span style={{ marginLeft: 8, color: "#94a3b8" }}>•</span>
                <span style={{ marginLeft: 8, fontWeight: 700, color: "#0f172a" }}>
                  {`Update Data: ${data.latestDataDate || "-"}`}
                </span>
                <span style={{ marginLeft: 8, color: "#94a3b8" }}>•</span>
                <span style={{ marginLeft: 8 }}>
                  {`Report: ${data.reportDate || "-"}`}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: 10,
              border: "2px solid #0284c7",
              backgroundColor: "#f0f9ff",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, color: "#0369a1", letterSpacing: "0.12em" }}>
              AUTO REPORT
            </div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#0c4a6e", letterSpacing: "0.08em" }}>
              09:00 WIB
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "14px 24px 10px 24px",
            flex: 1,
          }}
        >
          {/* 4 KPI Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            {[
              {
                title: "TOTAL HUB STD",
                val: String(data.summary.totalHubs),
                sub: tierSummary || "-",
                bg: "#fffbf0",
                border: "#fde68a",
                topBorder: "#f59e0b",
                valColor: "#0f172a",
              },
              {
                title: "AVG SD DELIVERING",
                val: fmtPct(data.summary.avgDeliveringMtd),
                sub: `MTD · WTD: ${fmtPct(data.summary.avgDeliveringWtd)}`,
                bg: "#f5f9ff",
                border: "#bfdbfe",
                topBorder: "#2563eb",
                valColor: "#0f172a",
              },
              {
                title: "AVG SD DELIVERED",
                val: fmtPct(data.summary.avgDeliveredMtd),
                sub: `MTD · WTD: ${fmtPct(data.summary.avgDeliveredWtd)}`,
                bg: "#f2fbf6",
                border: "#a7f3d0",
                topBorder: "#059669",
                valColor: "#047857",
              },
              {
                title: "ACHV VS TARGET",
                val: fmtPct(data.summary.avgAchvMtd, 2),
                sub: `On Target: ${statusStats.onTarget} · Mendekati: ${statusStats.nearTarget} · Below: ${statusStats.belowTarget}`,
                bg: "#f6f7ff",
                border: "#c7d2fe",
                topBorder: "#4f46e5",
                valColor: "#312e81",
              },
            ].map((c, idx) => (
              <div
                key={c.title}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: 274,
                  padding: "11px 14px",
                  borderRadius: 12,
                  backgroundColor: c.bg,
                  border: `1px solid ${c.border}`,
                  borderTop: `3px solid ${c.topBorder}`,
                  marginRight: idx < 3 ? 12 : 0,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 23, fontWeight: 800, color: c.valColor, marginTop: 3 }}>
                  {c.val}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginTop: 2 }}>
                  {c.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row: Line Chart (Left) + Status & Ranking (Right) */}
          <div style={{ display: "flex", flexDirection: "row", flex: 1 }}>
            {/* Left Panel: Line Chart */}
            <div
              style={{
                width: 738,
                marginRight: 14,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                border: "1px solid #cbd5e1",
                borderTop: "3px solid #0284c7",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                    Grafik Progres STD (14 Hari Terakhir)
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {`Rata-rata ${data.summary.totalHubs} Hub · Perbandingan SD Delivered terhadap target`}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  <span>{`Target Delivered: ${fmtPct(avgTargetDelivered)}`}</span>
                </div>
              </div>

              <div
                style={{
                  position: "relative",
                  width: svgW,
                  height: svgH,
                  display: "flex",
                }}
              >
                <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                  <defs>
                    <linearGradient id="stdAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.26" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Y Grid */}
                  {yTicks.map((tick) => {
                    const y = getY(tick);
                    return (
                      <line
                        key={tick}
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Reference Target Line */}
                  {avgTargetDelivered !== null &&
                    avgTargetDelivered >= yMin &&
                    avgTargetDelivered <= yMax && (
                      <line
                        x1={padL}
                        y1={getY(avgTargetDelivered)}
                        x2={svgW - padR}
                        y2={getY(avgTargetDelivered)}
                        stroke="#34d399"
                        strokeWidth="1.8"
                        strokeDasharray="6 4"
                      />
                    )}

                  {/* Area & Line */}
                  {areaPath && <path d={areaPath} fill="url(#stdAreaGrad)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Dots */}
                  {validDots.map((d) => (
                    <circle
                      key={`dot-${d.idx}`}
                      cx={d.x}
                      cy={d.y}
                      r={3.8}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.6"
                    />
                  ))}
                </svg>

                {/* Y Axis Labels Overlay */}
                {yTicks.map((tick) => (
                  <div
                    key={`ylbl-${tick}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      width: padL - 8,
                      top: getY(tick) - 7,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    {`${tick}%`}
                  </div>
                ))}

                {/* Dot Value Labels Overlay */}
                {validDots.map((d) => (
                  <div
                    key={`dlbl-${d.idx}`}
                    style={{
                      position: "absolute",
                      left: d.x - 24,
                      width: 48,
                      top: d.y - 22,
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        padding: "1px 4px",
                        borderRadius: 4,
                        backgroundColor: "rgba(255,255,255,0.88)",
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#047857",
                      }}
                    >
                      {fmtPct(d.val)}
                    </div>
                  </div>
                ))}

                {/* X Axis Labels Overlay */}
                {trendPoints.map((pt, idx) => {
                  const showLabel =
                    trendPoints.length <= 8 || idx % 2 === 0 || idx === trendPoints.length - 1;
                  if (!showLabel) return null;
                  return (
                    <div
                      key={`xlbl-${idx}`}
                      style={{
                        position: "absolute",
                        left: getX(idx) - 24,
                        width: 48,
                        top: svgH - 22,
                        display: "flex",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#64748b",
                      }}
                    >
                      {pt.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Donut & Ranking */}
            <div
              style={{
                width: 380,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                border: "1px solid #cbd5e1",
                borderTop: "3px solid #059669",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>
                  Status Target & Ranking Hub
                </div>

                {/* Donut Box */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 10,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 78,
                      height: 78,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <svg
                      width={78}
                      height={78}
                      viewBox="0 0 84 84"
                      style={{ transform: "rotate(-90deg)" }}
                    >
                      <circle
                        cx={42}
                        cy={42}
                        r={donutRadius}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth={9}
                      />
                      {statusStats.onTarget > 0 && (
                        <circle
                          cx={42}
                          cy={42}
                          r={donutRadius}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth={9}
                          strokeDasharray={`${onFrac * donutCirc} ${donutCirc}`}
                          strokeDashoffset={0}
                        />
                      )}
                      {statusStats.nearTarget > 0 && (
                        <circle
                          cx={42}
                          cy={42}
                          r={donutRadius}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={9}
                          strokeDasharray={`${nearFrac * donutCirc} ${donutCirc}`}
                          strokeDashoffset={-(onFrac * donutCirc)}
                        />
                      )}
                      {statusStats.belowTarget > 0 && (
                        <circle
                          cx={42}
                          cy={42}
                          r={donutRadius}
                          fill="none"
                          stroke="#f43f5e"
                          strokeWidth={9}
                          strokeDasharray={`${belowFrac * donutCirc} ${donutCirc}`}
                          strokeDashoffset={-((onFrac + nearFrac) * donutCirc)}
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 78,
                        height: 78,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                        {onPctText}
                      </div>
                      <div style={{ fontSize: 8, fontWeight: 600, color: "#64748b" }}>
                        On Target
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", flex: 1, fontSize: 11 }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ color: "#475569", fontWeight: 600 }}>On Target</span>
                      <span style={{ color: "#047857", fontWeight: 800 }}>{`${statusStats.onTarget} hub`}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ color: "#475569", fontWeight: 600 }}>Mendekati (-2%)</span>
                      <span style={{ color: "#b45309", fontWeight: 800 }}>{`${statusStats.nearTarget} hub`}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#475569", fontWeight: 600 }}>Below Target</span>
                      <span style={{ color: "#be123c", fontWeight: 800 }}>{`${statusStats.belowTarget} hub`}</span>
                    </div>
                  </div>
                </div>

                {/* Top 6 Terendah Bars */}
                <div style={{ fontSize: 11, fontWeight: 800, color: "#334155", marginBottom: 8 }}>
                  Delivered MTD vs Target (Terendah)
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {lowestRanked.map(({ row, mtd, target, gap }) => {
                    const barPct = Math.max(4, Math.min(100, ((mtd - 75) / 25) * 100));
                    const targetMarkerPct = Math.max(0, Math.min(100, ((target - 75) / 25) * 100));
                    const barColor =
                      gap >= 0 ? "#10b981" : gap >= -2 ? "#f59e0b" : "#f43f5e";
                    return (
                      <div
                        key={row.namaHub}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            fontSize: 11,
                            marginBottom: 3,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#1e293b" }}>
                            {row.namaHub}
                          </span>
                          <span style={{ fontWeight: 800, color: "#334155" }}>
                            {`${fmtPct(mtd)} / ${fmtPct(target)}`}
                          </span>
                        </div>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: 7,
                            borderRadius: 999,
                            backgroundColor: "#e2e8f0",
                            display: "flex",
                          }}
                        >
                          <div
                            style={{
                              width: `${barPct}%`,
                              height: "100%",
                              borderRadius: 999,
                              backgroundColor: barColor,
                              display: "flex",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: `${targetMarkerPct}%`,
                              top: -2,
                              width: 2,
                              height: 11,
                              backgroundColor: "#0f172a",
                              display: "flex",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 10, color: "#64748b", paddingTop: 6, borderTop: "1px solid #f1f5f9" }}>
                Garis tegak pada bar menandai target SD Delivered masing-masing Hub.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            padding: "0 24px 12px 24px",
            fontSize: 11,
            color: "#64748b",
          }}
        >
          <span>Monitor STD · NEW LM JATIM 8 (JTT08)</span>
          <span style={{ fontWeight: 700, color: "#475569" }}>
            Detail Hub di bawah target terlampir pada pesan caption
          </span>
        </div>
      </div>
    ),
    {
      width,
      height,
    }
  );

  const arrayBuffer = await image.arrayBuffer();
  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    width,
    height,
  };
}

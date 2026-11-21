import { ImageResponse } from "next/og";
import { formatDate, formatNumber } from "./utils";

export interface DailySummaryHubRow {
  hub: string;
  closingStatus: "OK" | "Kurang" | "Belum";
  missingCols: number;
  hasProd: boolean;
  volume: number;
  delivered: number;
  delivering: number;
  ohVol: number;
  backlog: number;
}

export interface DailySummaryImagePayload {
  targetDate: string;
  totalHubs: number;
  closedCount: number;
  prodFilledCount: number;
  totalVolumeAll: number;
  totalDeliveredAll: number;
  totalBacklogAll: number;
  backlogPctAll: string;
  totalExpediteAll: number;
  totalDeliveringAll: number;
  totalOhVolAll: number;
  missingClosingCount: number;
  incompleteCount: number;
  deliveringGantunganCount: number;
  onholdGantunganCount: number;
  manualHubCount?: number;
  hubRows: DailySummaryHubRow[];
}

function getClosingBadgeStyle(status: DailySummaryHubRow["closingStatus"]) {
  if (status === "OK") {
    return {
      backgroundColor: "#dcfce7",
      color: "#166534",
      border: "1px solid #86efac",
      label: "Sudah",
    };
  }
  if (status === "Kurang") {
    return {
      backgroundColor: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fcd34d",
      label: "Kurang",
    };
  }
  return {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
    label: "Belum",
  };
}

/**
 * Render gambar PNG ringkasan Daily Summary Closing JTT08 (00:05 WIB)
 * menggunakan Next.js ImageResponse agar berjalan langsung di serverless/Node tanpa browser.
 */
export async function generateDailySummaryImageBase64(
  data: DailySummaryImagePayload
): Promise<{ base64: string; width: number; height: number }> {
  const width = 1080;
  const rowHeight = 36;
  const headerBlock = 248;
  const tableHeaderHeight = 42;
  const footerHeight = 68;
  const rowsCount = Math.max(1, data.hubRows.length);
  const height = headerBlock + tableHeaderHeight + rowsCount * rowHeight + footerHeight;

  const closingPct =
    data.totalHubs > 0
      ? ((data.closedCount / data.totalHubs) * 100).toFixed(1)
      : "0.0";
  const prodPct =
    data.totalHubs > 0
      ? ((data.prodFilledCount / data.totalHubs) * 100).toFixed(1)
      : "0.0";
  const delvdPct =
    data.totalVolumeAll > 0
      ? ((data.totalDeliveredAll / data.totalVolumeAll) * 100).toFixed(1)
      : "0.0";

  const kpiCards = [
    {
      label: "HUB CLOSING",
      value: `${data.closedCount}/${data.totalHubs}`,
      sub: `${closingPct}% Terisi`,
      accent: "#059669",
      bg: "#ecfdf5",
      border: "#a7f3d0",
    },
    {
      label: "PRODUCTIVITY",
      value: `${data.prodFilledCount}/${data.totalHubs}`,
      sub: `${prodPct}% Terisi`,
      accent: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
    },
    {
      label: "TOTAL VOLUME",
      value: formatNumber(data.totalVolumeAll),
      sub: `Exp: ${formatNumber(data.totalExpediteAll)}`,
      accent: "#0f172a",
      bg: "#f8fafc",
      border: "#cbd5e1",
    },
    {
      label: "DELIVERED",
      value: formatNumber(data.totalDeliveredAll),
      sub: `${delvdPct}% Rate`,
      accent: "#047857",
      bg: "#f0fdf4",
      border: "#bbf7d0",
    },
    {
      label: "BACKLOG TOTAL",
      value: formatNumber(data.totalBacklogAll),
      sub: `${data.backlogPctAll}% dr Vol`,
      accent: data.totalBacklogAll > 0 ? "#c2410c" : "#047857",
      bg: data.totalBacklogAll > 0 ? "#fff7ed" : "#f0fdf4",
      border: data.totalBacklogAll > 0 ? "#fed7aa" : "#bbf7d0",
    },
    {
      label: "GANTUNGAN (DLVG / OH)",
      value: `${formatNumber(data.totalDeliveringAll)} / ${formatNumber(data.totalOhVolAll)}`,
      sub: `${data.deliveringGantunganCount} Delvg • ${data.onholdGantunganCount} OH Hub`,
      accent:
        data.totalDeliveringAll > 0 || data.totalOhVolAll > 0
          ? "#b91c1c"
          : "#047857",
      bg:
        data.totalDeliveringAll > 0 || data.totalOhVolAll > 0
          ? "#fef2f2"
          : "#f0fdf4",
      border:
        data.totalDeliveringAll > 0 || data.totalOhVolAll > 0
          ? "#fecaca"
          : "#bbf7d0",
    },
  ];

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            width: "100%",
            height: 8,
            backgroundColor: "#ee4d2d",
            display: "flex",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 28px 14px 28px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: "#fff1ed",
                border: "2px solid #fdba74",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
                fontSize: 15,
                fontWeight: 800,
                color: "#c2410c",
              }}
            >
              JTT08
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                DAILY SUMMARY CLOSING REPORT — JTT08
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  fontSize: 13,
                  color: "#475569",
                }}
              >
                <span>Tanggal Operasional: </span>
                <span style={{ fontWeight: 700, color: "#0f172a", marginLeft: 4 }}>
                  {formatDate(data.targetDate)}
                </span>
                <span style={{ marginLeft: 10, color: "#94a3b8" }}>•</span>
                <span style={{ marginLeft: 10, fontWeight: 600, color: "#0369a1" }}>
                  Auto Summary 00:05 WIB
                </span>
              </div>
            </div>
          </div>

          {/* Stamp */}
          {(data.manualHubCount ?? 0) > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 14px",
                borderRadius: 10,
                border: "2px solid #dc2626",
                backgroundColor: "#fef2f2",
                transform: "rotate(-4deg)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#b91c1c",
                  letterSpacing: "0.14em",
                }}
              >
                MODIFIED MANUAL
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#991b1b",
                  letterSpacing: "0.12em",
                  marginTop: 1,
                }}
              >
                REPORT DETECTED
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 14px",
                borderRadius: 10,
                border: "2px solid #059669",
                backgroundColor: "#ecfdf5",
                transform: "rotate(-4deg)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "#047857",
                  letterSpacing: "0.14em",
                }}
              >
                ORIGINAL REPORT
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#065f46",
                  letterSpacing: "0.18em",
                  marginTop: 1,
                }}
              >
                SUMMARY
              </div>
            </div>
          )}
        </div>

        {/* KPI Strip */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            padding: "16px 28px 14px 28px",
            backgroundColor: "#ffffff",
          }}
        >
          {kpiCards.map((card, idx) => (
            <div
              key={card.label}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: 162,
                padding: "10px 12px",
                borderRadius: 12,
                backgroundColor: card.bg,
                border: `1px solid ${card.border}`,
                marginRight: idx < kpiCards.length - 1 ? 10 : 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#475569",
                  letterSpacing: "0.04em",
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: card.accent,
                  marginTop: 4,
                }}
              >
                {card.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  marginTop: 2,
                }}
              >
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Table Section Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 28px 6px 28px",
          }}
        >
          <div style={{ display: "flex", fontSize: 12, fontWeight: 800, color: "#334155", letterSpacing: "0.05em" }}>
            {`RINGKASAN PER HUB (${data.totalHubs} HUB)`}
          </div>
          <div style={{ display: "flex", fontSize: 11, fontWeight: 600, color: "#64748b" }}>
            {`Belum Closing: ${data.missingClosingCount} • Belum Lengkap / Prod Kosong: ${data.incompleteCount}`}
          </div>
        </div>

        {/* Table Container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            margin: "0 28px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            overflow: "hidden",
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              height: tableHeaderHeight,
              backgroundColor: "#0f172a",
              color: "#f8fafc",
              fontSize: 11,
              fontWeight: 700,
              padding: "0 14px",
              letterSpacing: "0.04em",
            }}
          >
            <div style={{ width: 34, display: "flex" }}>#</div>
            <div style={{ width: 256, display: "flex" }}>NAMA HUB</div>
            <div style={{ width: 110, display: "flex", justifyContent: "center" }}>CLOSING</div>
            <div style={{ width: 96, display: "flex", justifyContent: "center" }}>PROD</div>
            <div style={{ width: 108, display: "flex", justifyContent: "flex-end" }}>VOLUME</div>
            <div style={{ width: 108, display: "flex", justifyContent: "flex-end" }}>DELVD</div>
            <div style={{ width: 92, display: "flex", justifyContent: "flex-end" }}>DELVG</div>
            <div style={{ width: 92, display: "flex", justifyContent: "flex-end" }}>OH VOL</div>
            <div style={{ width: 100, display: "flex", justifyContent: "flex-end" }}>BACKLOG</div>
          </div>

          {/* Rows */}
          {data.hubRows.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: rowHeight,
                fontSize: 12,
                color: "#64748b",
                backgroundColor: "#ffffff",
              }}
            >
              Tidak ada data Hub terdaftar.
            </div>
          ) : (
            data.hubRows.map((row, idx) => {
              const badge = getClosingBadgeStyle(row.closingStatus);
              const isSubmitted = row.closingStatus !== "Belum";
              const rowBg =
                row.closingStatus === "Belum"
                  ? "#fff5f5"
                  : idx % 2 === 0
                  ? "#ffffff"
                  : "#f8fafc";

              return (
                <div
                  key={row.hub}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    height: rowHeight,
                    backgroundColor: rowBg,
                    borderTop: "1px solid #e2e8f0",
                    padding: "0 14px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ width: 34, display: "flex", color: "#64748b", fontWeight: 600 }}>
                    {idx + 1}
                  </div>
                  <div
                    style={{
                      width: 256,
                      display: "flex",
                      fontWeight: 700,
                      color: "#0f172a",
                      overflow: "hidden",
                    }}
                  >
                    {row.hub}
                  </div>
                  <div style={{ width: 110, display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: badge.backgroundColor,
                        color: badge.color,
                        border: badge.border,
                      }}
                    >
                      {row.closingStatus === "Kurang"
                        ? `Kurang (${row.missingCols})`
                        : badge.label}
                    </div>
                  </div>
                  <div style={{ width: 96, display: "flex", justifyContent: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: row.hasProd ? "#dcfce7" : "#fee2e2",
                        color: row.hasProd ? "#166534" : "#991b1b",
                        border: row.hasProd ? "1px solid #86efac" : "1px solid #fca5a5",
                      }}
                    >
                      {row.hasProd ? "Ada" : "Kosong"}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 108,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontWeight: 700,
                      color: isSubmitted ? "#0f172a" : "#94a3b8",
                    }}
                  >
                    {isSubmitted ? formatNumber(row.volume) : "-"}
                  </div>
                  <div
                    style={{
                      width: 108,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontWeight: 600,
                      color: isSubmitted ? "#047857" : "#94a3b8",
                    }}
                  >
                    {isSubmitted ? formatNumber(row.delivered) : "-"}
                  </div>
                  <div
                    style={{
                      width: 92,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontWeight: row.delivering > 0 ? 800 : 500,
                      color: !isSubmitted
                        ? "#94a3b8"
                        : row.delivering > 0
                        ? "#b91c1c"
                        : "#64748b",
                    }}
                  >
                    {isSubmitted ? formatNumber(row.delivering) : "-"}
                  </div>
                  <div
                    style={{
                      width: 92,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontWeight: row.ohVol > 0 ? 800 : 500,
                      color: !isSubmitted
                        ? "#94a3b8"
                        : row.ohVol > 0
                        ? "#b45309"
                        : "#64748b",
                    }}
                  >
                    {isSubmitted ? formatNumber(row.ohVol) : "-"}
                  </div>
                  <div
                    style={{
                      width: 100,
                      display: "flex",
                      justifyContent: "flex-end",
                      fontWeight: row.backlog > 0 ? 700 : 500,
                      color: !isSubmitted
                        ? "#94a3b8"
                        : row.backlog > 0
                        ? "#c2410c"
                        : "#64748b",
                    }}
                  >
                    {isSubmitted ? formatNumber(row.backlog) : "-"}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 28px",
            fontSize: 11,
            color: "#64748b",
          }}
        >
          <div style={{ display: "flex" }}>
            Closing LM SPX Express — Area JTT08 • Detail PIC tercantum pada pesan caption
          </div>
          <div style={{ display: "flex", fontWeight: 700, color: "#475569" }}>
            {`Total Expedite: ${formatNumber(data.totalExpediteAll)}`}
          </div>
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

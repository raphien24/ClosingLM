import { ImageResponse } from "next/og";
import type { ClosingData } from "@/types/closing";
import { parseTimestamp } from "./dateUtils";
import { evaluateReportCompleteness, formatDate, formatNumber } from "./utils";

function fmtVal(
  val: number | null | undefined,
  decimals = 0,
  suffix = ""
): string {
  if (val === null || val === undefined) return "-";
  if (decimals > 0) {
    return formatNumber(val, decimals).replace(/,0$/, "") + suffix;
  }
  return formatNumber(val, 0) + suffix;
}

function ProdBadgeStyle(
  value: number | null | undefined,
  target: number | null | undefined,
  invertTarget = false
) {
  const hasVal = value !== null && value !== undefined;
  const hasTarget = target !== null && target !== undefined && target > 0;
  const isGreen =
    hasVal && hasTarget
      ? invertTarget
        ? value! <= target!
        : value! >= target!
      : true;

  return {
    hasVal,
    text: hasVal ? formatNumber(value, 1).replace(/,0$/, "") : "-",
    bg: isGreen ? "#d1fae5" : "#fee2e2",
    color: isGreen ? "#065f46" : "#b91c1c",
    border: isGreen ? "1px solid #6ee7b7" : "1px solid #fca5a5",
    targetText: hasTarget ? `(Target ${invertTarget ? "≤" : "≥"} ${target})` : "",
  };
}

/**
 * Render gambar PNG kartu Summary Today Hub (`HubSummaryReportCard`) untuk dikirim saat
 * Auto Confirm Closing Soko Hub jam 23:19 WIB ke grup SeaTalk.
 */
export async function generateHubConfirmImageBase64(
  row: ClosingData
): Promise<{ base64: string; width: number; height: number }> {
  const completeness = evaluateReportCompleteness(row);
  const manualSet = new Set(row.manual_fields || []);
  const manualCount = manualSet.size;
  const hasData = Boolean(row.submitted_at);

  const updateTime = row.submitted_at
    ? parseTimestamp(row.submitted_at)?.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      }) ?? row.submitted_at
    : null;

  const width = 940;
  const height = completeness.isComplete ? 780 : 885;

  const renderMetricRow = (
    label: string,
    val: number | null | undefined,
    opts?: {
      fieldKey?: string;
      suffix?: string;
      decimals?: number;
      color?: string;
    }
  ) => {
    const isManual = opts?.fieldKey ? manualSet.has(opts.fieldKey) : false;
    const text = fmtVal(val, opts?.decimals ?? 0, opts?.suffix ?? "");
    return (
      <div
        key={label}
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px 11px",
          borderRadius: 8,
          backgroundColor: isManual ? "#faf5ff" : "#f8fafc",
          border: isManual ? "1px solid #d8b4fe" : "1px solid #e2e8f0",
          marginBottom: 6,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#475569", fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <span
            style={{
              fontWeight: 800,
              color: val === null || val === undefined ? "#94a3b8" : opts?.color || "#0f172a",
            }}
          >
            {text}
          </span>
          {isManual && (
            <div
              style={{
                marginLeft: 6,
                padding: "1px 5px",
                borderRadius: 4,
                backgroundColor: "#e9d5ff",
                color: "#6b21a8",
                fontSize: 9,
                fontWeight: 800,
                display: "flex",
              }}
            >
              M
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProdRow = (
    label: string,
    val: number | null | undefined,
    target: number | null | undefined,
    invertTarget = false
  ) => {
    const info = ProdBadgeStyle(val, target, invertTarget);
    return (
      <div
        key={label}
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "7px 11px",
          borderRadius: 8,
          backgroundColor: "#f8fafc",
          border: "1px solid #e2e8f0",
          marginBottom: 6,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <span style={{ color: "#334155", fontWeight: 600 }}>{label}</span>
          {info.targetText && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#94a3b8" }}>
              {info.targetText}
            </span>
          )}
        </div>
        {info.hasVal ? (
          <div
            style={{
              display: "flex",
              padding: "1px 8px",
              borderRadius: 5,
              backgroundColor: info.bg,
              border: info.border,
              color: info.color,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {info.text}
          </div>
        ) : (
          <span style={{ color: "#94a3b8", fontWeight: 800 }}>-</span>
        )}
      </div>
    );
  };

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
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                backgroundColor: "#e0f2fe",
                border: "1px solid #bae6fd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
                fontSize: 13,
                fontWeight: 800,
                color: "#0369a1",
              }}
            >
              HUB
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: "#0f172a" }}>
                  {row.nama_hub}
                </div>
                <div
                  style={{
                    marginLeft: 10,
                    padding: "2px 10px",
                    borderRadius: 999,
                    backgroundColor: hasData ? "#d1fae5" : "#ffedd5",
                    color: hasData ? "#065f46" : "#9a3412",
                    fontSize: 11,
                    fontWeight: 800,
                    display: "flex",
                  }}
                >
                  {hasData ? "Sudah Closing" : "Belum Submit"}
                </div>
                {manualCount > 0 && (
                  <div
                    style={{
                      marginLeft: 8,
                      padding: "2px 10px",
                      borderRadius: 999,
                      backgroundColor: "#f3e8ff",
                      color: "#6b21a8",
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                    }}
                  >
                    {`${manualCount} Input Manual`}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>{`Tanggal: ${formatDate(row.tanggal)}`}</span>
                {updateTime && (
                  <span style={{ marginLeft: 12 }}>{`• Update ${updateTime} WIB`}</span>
                )}
                {row.submitted_by && (
                  <span style={{ marginLeft: 12 }}>{`• ${row.submitted_by}`}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stamp */}
          {hasData &&
            (manualCount > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: 9,
                  border: "2px solid #dc2626",
                  backgroundColor: "#fef2f2",
                  transform: "rotate(-5deg)",
                }}
              >
                <div style={{ fontSize: 8, fontWeight: 900, color: "#b91c1c", letterSpacing: "0.14em" }}>
                  MODIFIED MANUAL
                </div>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#991b1b", letterSpacing: "0.12em" }}>
                  REPORT DETECTED
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: 9,
                  border: "2px solid #059669",
                  backgroundColor: "#ecfdf5",
                  transform: "rotate(-5deg)",
                }}
              >
                <div style={{ fontSize: 8, fontWeight: 900, color: "#047857", letterSpacing: "0.14em" }}>
                  ORIGINAL REPORT
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#065f46", letterSpacing: "0.18em" }}>
                  APPROVED
                </div>
              </div>
            ))}
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", flex: 1 }}>
          {!completeness.isComplete && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #fecaca",
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 3 }}>
                Pemberitahuan: Report Closing & Productivity Belum Lengkap
              </div>
              {completeness.issues.map((issue, idx) => (
                <div key={idx} style={{ display: "flex" }}>
                  {`• ${issue}`}
                </div>
              ))}
            </div>
          )}

          {/* 4 Summary Cards */}
          <div style={{ display: "flex", flexDirection: "row", marginBottom: 14 }}>
            {[
              {
                label: "TOTAL VOLUME",
                val: fmtVal(row.total_volume),
                bg: "#eef2ff",
                border: "#c7d2fe",
                top: "#6366f1",
                color: "#4338ca",
              },
              {
                label: "FLEET DELIVERED",
                val: fmtVal(row.fleet_delivered),
                bg: "#ecfdf5",
                border: "#a7f3d0",
                top: "#10b981",
                color: "#047857",
              },
              {
                label: "TOTAL BACKLOG",
                val: `${fmtVal(row.backlog_total)}${row.backlog_pct != null ? ` (${row.backlog_pct.toFixed(1)}%)` : ""}`,
                bg: "#fff1f2",
                border: "#fecdd3",
                top: "#f43f5e",
                color: "#be123c",
              },
              {
                label: "TOTAL EXPEDITE",
                val: fmtVal(row.total_expedite),
                bg: "#fffbeb",
                border: "#fde68a",
                top: "#f59e0b",
                color: "#c2410c",
              },
            ].map((k, idx) => (
              <div
                key={k.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 12,
                  backgroundColor: k.bg,
                  border: `1px solid ${k.border}`,
                  borderTop: `3px solid ${k.top}`,
                  marginRight: idx < 3 ? 10 : 0,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569" }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginTop: 3 }}>
                  {k.val}
                </div>
              </div>
            ))}
          </div>

          {/* 2x2 Detail Sections */}
          <div style={{ display: "flex", flexDirection: "row", marginBottom: 12 }}>
            {/* In Hub Status */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "12px 14px",
                marginRight: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                IN HUB STATUS
              </div>
              {renderMetricRow("Transported (Volume)", row.in_hub_transported, { fieldKey: "in_hub_transported" })}
              {renderMetricRow("Received (Volume)", row.in_hub_received, { fieldKey: "in_hub_received" })}
              {renderMetricRow("Assigning (Volume)", row.in_hub_assigning, { fieldKey: "in_hub_assigning" })}
              {renderMetricRow("Assigned (Volume)", row.in_hub_assigned, { fieldKey: "in_hub_assigned" })}
            </div>

            {/* Fleet Status */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                FLEET STATUS
              </div>
              {renderMetricRow("Delivering (Volume)", row.fleet_delivering, { fieldKey: "fleet_delivering" })}
              {renderMetricRow("Delivered", row.fleet_delivered, { fieldKey: "fleet_delivered", color: "#047857" })}
              {renderMetricRow("On-hold Volume", row.fleet_oh_volume, { fieldKey: "fleet_oh_volume" })}
              {renderMetricRow("On-hold Total", row.fleet_oh_total, { fieldKey: "fleet_oh_total" })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "row", marginBottom: 12 }}>
            {/* Fleet Head Counts */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "12px 14px",
                marginRight: 12,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                FLEET HEAD COUNTS
              </div>
              {renderMetricRow("Dedicated 2WH", row.dedicated_actual_2wh, { fieldKey: "dedicated_actual_2wh" })}
              {renderMetricRow("Kurir Plus 2WH", row.kurir_plus_actual_2wh, { fieldKey: "kurir_plus_actual_2wh" })}
              {renderMetricRow("Dedicated 4WH", row.dedicated_actual_4wh, { fieldKey: "dedicated_actual_4wh" })}
              {renderMetricRow("Mitra 2WH", row.mitra_actual_2wh, { fieldKey: "mitra_actual_2wh" })}
              {renderMetricRow("Mitra 4WH", row.mitra_actual_4wh, { fieldKey: "mitra_actual_4wh" })}
            </div>

            {/* Daily Productivity */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                DAILY PRODUCTIVITY
              </div>
              {renderProdRow("2W Dedicated", row.prod_2w_dedicated, row.target_2w_dedicated)}
              {renderProdRow("2W Kurir Plus", row.prod_2w_kurir_plus, row.target_2w_kurir_plus)}
              {renderProdRow("4W Dedicated", row.prod_4w_dedicated, row.target_4w_dedicated)}
              {renderProdRow("2W Mitra", row.prod_2w_mitra, row.target_2w_mitra, true)}
              {renderProdRow("4W Mitra", row.prod_4w_mitra, row.target_4w_mitra, true)}
            </div>
          </div>

          {/* Bottom Section: Backlog & Parcel Sweeper */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
              BACKLOG, EXPEDITE & PARCEL SWEEPER
            </div>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", width: 274 }}>
                {renderMetricRow("Backlog Total", row.backlog_total, { fieldKey: "backlog_total", color: "#b91c1c" })}
                {renderMetricRow("Parcel Sweeper Total", row.parcel_sweeper_total, { fieldKey: "parcel_sweeper_total" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", width: 274 }}>
                {renderMetricRow("Backlog % vs Volume", row.backlog_pct, { decimals: 1, suffix: "%", color: "#be123c" })}
                {renderMetricRow("PS Scanned (%)", row.parcel_sweeper_scanned_pct, { fieldKey: "parcel_sweeper_scanned_pct", decimals: 1, suffix: "%", color: "#1d4ed8" })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", width: 274 }}>
                {renderMetricRow("Total Expedite", row.total_expedite, { fieldKey: "total_expedite", color: "#ea580c" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width, height }
  );

  const arrayBuffer = await image.arrayBuffer();
  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    width,
    height,
  };
}

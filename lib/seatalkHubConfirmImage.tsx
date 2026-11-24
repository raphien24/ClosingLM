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

function SvgBuilding2({ size = 20, color = "#0369a1" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}

function SvgCheckCircle2({ size = 12, color = "#065f46" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SvgAlertTriangle({ size = 12, color = "#9a3412" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SvgClock({ size = 14, color = "#9ca3af" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SvgUserCheck({ size = 14, color = "#9ca3af" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function SvgPackageCheck({ size = 16, color = "#0284c7" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 2 2 4-4" />
      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
      <path d="m7.5 4.27 9 5.15" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" x2="12" y1="22" y2="12" />
    </svg>
  );
}

function SvgTruck({ size = 16, color = "#d97706" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}

function SvgUsers({ size = 16, color = "#4f46e5" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SvgTrendingUp({ size = 16, color = "#059669" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SvgScanLine({ size = 16, color = "#e11d48" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

/**
 * Render gambar PNG kartu Summary Today Hub (`HubSummaryReportCard`) agar identik secara visual
 * dengan tangkapan layar tombol manual "Confirm Closing & Send Seatalk", untuk Auto Confirm Soko Hub.
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

  const width = 896;
  const alertExtraHeight = completeness.isComplete
    ? 0
    : 58 + completeness.issues.length * 18;
  const height = 910 + alertExtraHeight;

  const renderMetricRow = (
    label: string,
    val: number | null | undefined,
    opts?: {
      fieldKey?: string;
      suffix?: string;
      decimals?: number;
      color?: string;
      isLast?: boolean;
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
          padding: "8px 12px",
          borderRadius: 8,
          backgroundColor: isManual ? "rgba(250, 245, 255, 0.7)" : "rgba(249, 250, 251, 0.8)",
          border: isManual ? "1px solid #e9d5ff" : "1px solid #f3f4f6",
          marginBottom: opts?.isLast ? 0 : 8,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#4b5563", fontWeight: 500 }}>{label}</span>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <span
            style={{
              fontWeight: 700,
              color: val === null || val === undefined ? "#9ca3af" : opts?.color || "#111827",
            }}
          >
            {text}
          </span>
          {isManual && (
            <div
              style={{
                marginLeft: 6,
                padding: "0px 4px",
                borderRadius: 4,
                backgroundColor: "rgba(233, 213, 255, 0.8)",
                color: "#7e22ce",
                fontSize: 9,
                fontWeight: 700,
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
    invertTarget = false,
    isLast = false
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
          padding: "8px 12px",
          borderRadius: 8,
          backgroundColor: "rgba(249, 250, 251, 0.8)",
          border: "1px solid #f3f4f6",
          marginBottom: isLast ? 0 : 8,
          fontSize: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
          <span style={{ color: "#374151", fontWeight: 500 }}>{label}</span>
          {info.targetText && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>
              {info.targetText}
            </span>
          )}
        </div>
        {info.hasVal ? (
          <div
            style={{
              display: "flex",
              padding: "2px 8px",
              borderRadius: 4,
              backgroundColor: info.bg,
              border: info.border,
              color: info.color,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {info.text}
          </div>
        ) : (
          <span style={{ color: "#9ca3af", fontWeight: 700 }}>-</span>
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
          padding: 12,
          backgroundColor: "#e8eef5",
          fontFamily: "sans-serif",
        }}
      >
        {/* Card Container (menyamai HubSummaryReportCard) */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.22)",
            overflow: "hidden",
            color: "#111827",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              backgroundColor: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <SvgBuilding2 size={20} color="#0369a1" />
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                    {row.nama_hub}
                  </div>
                  <div
                    style={{
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: hasData ? "#d1fae5" : "#ffedd5",
                      color: hasData ? "#065f46" : "#9a3412",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", marginRight: 4 }}>
                      {hasData ? (
                        <SvgCheckCircle2 size={12} color="#065f46" />
                      ) : (
                        <SvgAlertTriangle size={12} color="#9a3412" />
                      )}
                    </div>
                    <span>{hasData ? "Sudah Closing" : "Belum Submit"}</span>
                  </div>
                  {manualCount > 0 && (
                    <div
                      style={{
                        marginLeft: 8,
                        padding: "2px 8px",
                        borderRadius: 999,
                        backgroundColor: "#f3e8ff",
                        color: "#6b21a8",
                        fontSize: 12,
                        fontWeight: 700,
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
                    marginTop: 5,
                    fontSize: 12,
                    color: "#6b7280",
                  }}
                >
                  <span>Tanggal:</span>
                  <span style={{ marginLeft: 4, fontWeight: 700, color: "#374151" }}>
                    {formatDate(row.tanggal)}
                  </span>
                  {updateTime && (
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginLeft: 12 }}>
                      <div style={{ display: "flex", marginRight: 4 }}>
                        <SvgClock size={14} color="#9ca3af" />
                      </div>
                      <span>{`Update ${updateTime} WIB`}</span>
                    </div>
                  )}
                  {row.submitted_by && (
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginLeft: 12 }}>
                      <div style={{ display: "flex", marginRight: 4 }}>
                        <SvgUserCheck size={14} color="#9ca3af" />
                      </div>
                      <span>{row.submitted_by}</span>
                    </div>
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
                    padding: 2,
                    borderRadius: 8,
                    border: "2px solid rgba(220, 38, 38, 0.85)",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    transform: "rotate(-6deg)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      borderRadius: 5,
                      border: "1px dashed rgba(220, 38, 38, 0.75)",
                      padding: "4px 10px",
                    }}
                  >
                    <div style={{ display: "flex", fontSize: 8, fontWeight: 900, color: "#b91c1c", letterSpacing: "0.14em" }}>
                      ! MODIFIED MANUAL !
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#b91c1c", letterSpacing: "0.14em", marginTop: 2 }}>
                      REPORT DETECTED
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    padding: 2,
                    borderRadius: 8,
                    border: "2px solid rgba(5, 150, 105, 0.8)",
                    backgroundColor: "rgba(16, 185, 129, 0.06)",
                    transform: "rotate(-6deg)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      borderRadius: 5,
                      border: "1px dashed rgba(5, 150, 105, 0.7)",
                      padding: "4px 10px",
                    }}
                  >
                    <div style={{ display: "flex", fontSize: 8, fontWeight: 900, color: "#047857", letterSpacing: "0.14em" }}>
                      * ORIGINAL REPORT *
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#047857", letterSpacing: "0.2em", marginTop: 2 }}>
                      APPROVED
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Body */}
          <div style={{ display: "flex", flexDirection: "column", padding: 20, flex: 1 }}>
            {!completeness.isComplete && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  marginBottom: 18,
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", marginRight: 10, marginTop: 2 }}>
                  <SvgAlertTriangle size={16} color="#dc2626" />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontWeight: 800, color: "#7f1d1d", marginBottom: 4 }}>
                    Pemberitahuan: Report Closing &amp; Productivity Belum Lengkap
                  </div>
                  {completeness.issues.map((issue, idx) => (
                    <div key={idx} style={{ display: "flex", marginBottom: 2 }}>
                      {`• ${issue}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4 Summary Cards */}
            <div style={{ display: "flex", flexDirection: "row", marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: "#eef2ff",
                  border: "1px solid #c7d2fe",
                  borderTop: "3px solid #6366f1",
                  marginRight: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(67, 56, 202, 0.85)", letterSpacing: "0.02em" }}>
                  TOTAL VOLUME
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#4338ca", marginTop: 4 }}>
                  {fmtVal(row.total_volume)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderTop: "3px solid #10b981",
                  marginRight: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(4, 120, 87, 0.85)", letterSpacing: "0.02em" }}>
                  FLEET DELIVERED
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#047857", marginTop: 4 }}>
                  {fmtVal(row.fleet_delivered)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderTop: "3px solid #f43f5e",
                  marginRight: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(190, 18, 60, 0.85)", letterSpacing: "0.02em" }}>
                  TOTAL BACKLOG
                </div>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#be123c" }}>
                    {fmtVal(row.backlog_total)}
                  </span>
                  {row.backlog_pct != null && (
                    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: "#e11d48" }}>
                      {`(${row.backlog_pct.toFixed(1)}%)`}
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderTop: "3px solid #f59e0b",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(194, 65, 12, 0.85)", letterSpacing: "0.02em" }}>
                  TOTAL EXPEDITE
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#c2410c", marginTop: 4 }}>
                  {fmtVal(row.total_expedite)}
                </div>
              </div>
            </div>

            {/* 2x2 Detail Sections */}
            <div style={{ display: "flex", flexDirection: "row", marginBottom: 16 }}>
              {/* In Hub Status */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                  marginRight: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", marginRight: 6 }}>
                    <SvgPackageCheck size={16} color="#0284c7" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", letterSpacing: "0.04em" }}>
                    IN HUB STATUS
                  </span>
                </div>
                {renderMetricRow("Transported (Volume)", row.in_hub_transported, { fieldKey: "in_hub_transported" })}
                {renderMetricRow("Received (Volume)", row.in_hub_received, { fieldKey: "in_hub_received" })}
                {renderMetricRow("Assigning (Volume)", row.in_hub_assigning, { fieldKey: "in_hub_assigning" })}
                {renderMetricRow("Assigned (Volume)", row.in_hub_assigned, { fieldKey: "in_hub_assigned", isLast: true })}
              </div>

              {/* Fleet Status */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", marginRight: 6 }}>
                    <SvgTruck size={16} color="#d97706" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", letterSpacing: "0.04em" }}>
                    FLEET STATUS
                  </span>
                </div>
                {renderMetricRow("Delivering (Volume)", row.fleet_delivering, { fieldKey: "fleet_delivering" })}
                {renderMetricRow("Delivered", row.fleet_delivered, { fieldKey: "fleet_delivered", color: "#047857" })}
                {renderMetricRow("On-hold Volume", row.fleet_oh_volume, { fieldKey: "fleet_oh_volume" })}
                {renderMetricRow("On-hold Total", row.fleet_oh_total, { fieldKey: "fleet_oh_total", isLast: true })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", marginBottom: 16 }}>
              {/* Fleet Head Counts */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                  marginRight: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", marginRight: 6 }}>
                    <SvgUsers size={16} color="#4f46e5" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", letterSpacing: "0.04em" }}>
                    FLEET HEAD COUNTS
                  </span>
                </div>
                {renderMetricRow("Dedicated 2WH", row.dedicated_actual_2wh, { fieldKey: "dedicated_actual_2wh" })}
                {renderMetricRow("Kurir Plus 2WH", row.kurir_plus_actual_2wh, { fieldKey: "kurir_plus_actual_2wh" })}
                {renderMetricRow("Dedicated 4WH", row.dedicated_actual_4wh, { fieldKey: "dedicated_actual_4wh" })}
                {renderMetricRow("Mitra 2WH", row.mitra_actual_2wh, { fieldKey: "mitra_actual_2wh" })}
                {renderMetricRow("Mitra 4WH", row.mitra_actual_4wh, { fieldKey: "mitra_actual_4wh", isLast: true })}
              </div>

              {/* Daily Productivity */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", marginRight: 6 }}>
                    <SvgTrendingUp size={16} color="#059669" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", letterSpacing: "0.04em" }}>
                    DAILY PRODUCTIVITY
                  </span>
                </div>
                {renderProdRow("2W Dedicated", row.prod_2w_dedicated, row.target_2w_dedicated)}
                {renderProdRow("2W Kurir Plus", row.prod_2w_kurir_plus, row.target_2w_kurir_plus)}
                {renderProdRow("4W Dedicated", row.prod_4w_dedicated, row.target_4w_dedicated)}
                {renderProdRow("2W Mitra", row.prod_2w_mitra, row.target_2w_mitra, true)}
                {renderProdRow("4W Mitra", row.prod_4w_mitra, row.target_4w_mitra, true, true)}
              </div>
            </div>

            {/* Bottom Section: Backlog & Parcel Sweeper */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", marginRight: 6 }}>
                  <SvgScanLine size={16} color="#e11d48" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#1f2937", letterSpacing: "0.04em" }}>
                  BACKLOG, EXPEDITE &amp; PARCEL SWEEPER
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 8 }}>
                  {renderMetricRow("Backlog Total", row.backlog_total, { fieldKey: "backlog_total", color: "#b91c1c" })}
                  {renderMetricRow("Parcel Sweeper Total", row.parcel_sweeper_total, { fieldKey: "parcel_sweeper_total", isLast: true })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, marginRight: 8 }}>
                  {renderMetricRow("Backlog % vs Volume", row.backlog_pct, { decimals: 1, suffix: "%", color: "#e11d48" })}
                  {renderMetricRow("PS Scanned (%)", row.parcel_sweeper_scanned_pct, { fieldKey: "parcel_sweeper_scanned_pct", decimals: 1, suffix: "%", color: "#1d4ed8", isLast: true })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  {renderMetricRow("Total Expedite", row.total_expedite, { fieldKey: "total_expedite", color: "#ea580c", isLast: true })}
                </div>
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

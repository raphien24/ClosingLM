"use client";

import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { Navbar } from "@/components/layout/Navbar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { ClosingInsightCards } from "@/components/dashboard/ClosingInsightCards";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { HubTable } from "@/components/dashboard/HubTable";
import {
  NauticalChartBackdrop,
  LighthouseBeaconIcon,
  SailorCompassIcon,
} from "@/components/productivity/MaritimeAnimations";
import { DashboardShipWipeOverlay } from "@/components/ocean/DashboardShipWipeOverlay";
import type { ClosingData, KpiSummary } from "@/types/closing";

const PREVIEW_SESSION: Session = {
  user: {
    name: "Rafi",
    email: "rafi@spx-jtt08.local",
    hubName: "Soko Hub",
    hubUser: "Rafi",
    isAuthorized: true,
    isSuperAdmin: false,
    isExpired: false,
  },
  expires: "2099-12-31T23:59:59.000Z",
};

const makeRow = (
  hub: string,
  submitted: boolean,
  delivered = 0,
  transported = 0,
  backlog = 0,
  expedite = 0,
  oh = 0,
  delivering = 0
): ClosingData => ({
  tanggal: "2026-11-16",
  nama_hub: hub,
  in_hub_transported: submitted ? transported : null,
  in_hub_received: submitted ? Math.round(transported * 0.99) : null,
  in_hub_assigning: submitted ? 18 : null,
  in_hub_assigned: submitted ? 10 : null,
  fleet_delivering: submitted ? delivering : null,
  fleet_delivered: submitted ? delivered : null,
  fleet_oh_volume: submitted ? oh : null,
  fleet_oh_total: submitted ? (oh > 0 ? oh + 3 : 0) : null,
  dedicated_actual_2wh: submitted ? 14 : null,
  kurir_plus_actual_2wh: submitted ? 6 : null,
  dedicated_actual_4wh: submitted ? 2 : null,
  mitra_actual_2wh: submitted ? 5 : null,
  mitra_actual_4wh: submitted ? 1 : null,
  backlog_total: submitted ? backlog : null,
  backlog_to_buyer: null,
  backlog_to_seller: null,
  backlog_to_transfer: null,
  total_expedite: submitted ? expedite : null,
  parcel_sweeper_total: submitted ? 18 : null,
  parcel_sweeper_scanned_pct: submitted ? 97.5 : null,
  total_volume: submitted ? transported + oh + delivering : null,
  backlog_pct: submitted && transported > 0 ? Number(((backlog / transported) * 100).toFixed(1)) : null,
  prod_2w_dedicated: submitted ? 112.4 : null,
  prod_2w_kurir_plus: submitted ? 96.0 : null,
  prod_4w_dedicated: submitted ? 48.2 : null,
  prod_2w_mitra: submitted ? 62.5 : null,
  prod_4w_mitra: submitted ? 31.0 : null,
  target_2w_dedicated: 100,
  target_2w_kurir_plus: 95,
  target_4w_dedicated: 45,
  target_2w_mitra: 65,
  target_4w_mitra: 35,
  submitted_at: submitted ? "2026-11-16T21:45:00.000Z" : "",
  submitted_by: submitted ? "rafi@spx.local" : "",
  manual_fields: [],
});

const MOCK_ROWS: ClosingData[] = [
  makeRow("Soko Hub", true, 4820, 4850, 12, 8, 18, 0),
  makeRow("Babat Hub", true, 3910, 4050, 84, 34, 42, 65),
  makeRow("Bojonegoro Hub", true, 6210, 6280, 31, 15, 0, 0),
  makeRow("Balen Hub", false),
  makeRow("Baureno Hub", false),
];

const MOCK_KPI: KpiSummary = {
  totalDelivered: 14940,
  totalOnhold: 60,
  totalBacklog: 127,
  hubUpdated: 3,
  hubTotal: 5,
};

export default function PreviewShipPage() {
  const [revealStage, setRevealStage] = useState<"sailing" | "assembling" | "done">("sailing");
  const [selectedDate, setSelectedDate] = useState("2026-11-16");
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);

  useEffect(() => {
    if (revealStage !== "assembling") return;
    const t = setTimeout(() => setRevealStage("done"), 1300);
    return () => clearTimeout(t);
  }, [revealStage]);

  return (
    <SessionProvider session={PREVIEW_SESSION}>
      <Navbar />
      {revealStage === "sailing" && (
        <DashboardShipWipeOverlay
          phase="sailing"
          onShipPassed={() => setRevealStage("assembling")}
        />
      )}

      <div
        className={`min-h-screen bg-[#e7eef4] dark:bg-transparent ${
          revealStage !== "done" ? "overflow-x-clip" : ""
        }`}
      >
        <div
          className={`w-full px-2 sm:px-4 py-4 space-y-4 ${
            revealStage === "done"
              ? ""
              : revealStage === "assembling"
              ? "dashboard-assemble-stage dashboard-assemble-enter"
              : "dashboard-assemble-stage dashboard-assemble-pre"
          }`}
        >
          <div className="dash-hero relative overflow-hidden bg-gradient-to-r from-[#fffdf9] via-[#f8fafd] to-[#eef4f9] dark:from-[#121d2f] dark:via-[#142338] dark:to-[#10293a] border border-slate-200/90 dark:border-slate-700/80 border-l-4 border-l-amber-600 dark:border-l-amber-400 text-slate-900 dark:text-white rounded-2xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500/75 via-amber-300/60 to-transparent" />
            <NauticalChartBackdrop />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <LighthouseBeaconIcon />
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Welcome Back Sailor <span className="text-amber-700 dark:text-amber-300">Rafi</span>
                  </h1>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-2 font-medium">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Monitoring
                    </span>
                    <span>•</span>
                    <span>Hari ini — 16/11/2026</span>
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/90 border border-amber-300/70 text-slate-800 text-xs font-semibold rounded-full">
                <SailorCompassIcon className="h-3.5 w-3.5 text-amber-600" />
                Harbor Control • JTT08
              </span>
            </div>
          </div>

          <div className="dash-kpis">
            <KpiCards kpi={MOCK_KPI} />
          </div>
          <div className="dash-insights">
            <ClosingInsightCards data={MOCK_ROWS} />
          </div>
          <div className="dash-filter">
            <FilterBar
              allHubs={MOCK_ROWS.map((r) => r.nama_hub)}
              missingHubs={MOCK_ROWS.filter((r) => !r.submitted_at).map((r) => r.nama_hub)}
              selectedDate={selectedDate}
              selectedHubs={selectedHubs}
              onDateChange={setSelectedDate}
              onHubsChange={setSelectedHubs}
              onRefresh={() => {}}
            />
          </div>
          <div className="dash-table">
            <HubTable data={MOCK_ROWS} />
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}

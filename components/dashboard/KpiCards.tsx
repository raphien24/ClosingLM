"use client";

import { KpiSummary } from "@/types/closing";
import { formatNumber } from "@/lib/utils";
import { Package, AlertTriangle, CheckCircle, Clock, ArchiveX } from "lucide-react";

interface Props { kpi: KpiSummary; isLoading?: boolean; }

function Card({ title, value, subtitle, icon: Icon, color, isLoading }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color: "blue"|"red"|"yellow"|"green"|"purple";
  isLoading?: boolean;
}) {
  const c = {
    blue:   { bg: "bg-white border-slate-200/80 hover:border-blue-300",    icon: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",       val: "text-blue-700" },
    red:    { bg: "bg-white border-slate-200/80 hover:border-rose-300",    icon: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",       val: "text-rose-700" },
    yellow: { bg: "bg-white border-slate-200/80 hover:border-amber-300",   icon: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",    val: "text-amber-700" },
    green:  { bg: "bg-white border-slate-200/80 hover:border-emerald-300", icon: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100", val: "text-emerald-700" },
    purple: { bg: "bg-white border-slate-200/80 hover:border-purple-300",  icon: "bg-purple-50 text-purple-600 ring-1 ring-purple-100",  val: "text-purple-700" },
  }[color];

  return (
    <div className={`hover-lift rounded-2xl p-5 border shadow-xs ${c.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          {isLoading
            ? <div className="mt-2 h-8 w-24 bg-slate-200 animate-pulse rounded" />
            : <p className={`mt-1.5 text-2xl font-extrabold tracking-tight ${c.val}`}>{value}</p>}
          {subtitle && !isLoading && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function KpiCards({ kpi, isLoading }: Props) {
  const pct = kpi.hubTotal > 0 ? Math.round((kpi.hubUpdated / kpi.hubTotal) * 100) : 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <Card title="Total Delivered"   value={formatNumber(kpi.totalDelivered)}
        subtitle="Fleet Delivered hari ini" icon={Package}    color="blue"   isLoading={isLoading} />
      <Card title="Total On-hold"     value={formatNumber(kpi.totalOnhold)}
        subtitle="Fleet On-hold Total"     icon={AlertTriangle} color="yellow" isLoading={isLoading} />
      <Card title="Total Backlog"     value={formatNumber(kpi.totalBacklog)}
        subtitle="Ringkasan Hub"            icon={ArchiveX}  color="red"    isLoading={isLoading} />

      {/* Hub Update */}
      <div className="hover-lift rounded-2xl p-5 border border-slate-200/80 hover:border-emerald-300 shadow-xs bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hub Update</p>
            {isLoading
              ? <div className="mt-2 h-8 w-24 bg-slate-200 animate-pulse rounded" />
              : <>
                  <p className="mt-1.5 text-2xl font-extrabold text-emerald-700">
                    {kpi.hubUpdated}<span className="text-base font-normal text-slate-400">/{kpi.hubTotal}</span>
                  </p>
                  <div className="mt-2 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{pct}% hub sudah closing</p>
                </>}
          </div>
          <div className="rounded-xl p-2.5 bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      <Card title="Belum Update" value={String(kpi.hubTotal - kpi.hubUpdated)}
        subtitle="hub belum submit" icon={Clock}
        color={kpi.hubTotal - kpi.hubUpdated > 0 ? "red" : "green"} isLoading={isLoading} />
    </div>
  );
}

"use client";

import { ProductivityKpi, WeeklyMitraSegment, WeeklyAllocation2wh, WeeklyActionPlan } from "@/types/productivity";
import { TrendingUp, TrendingDown, Users, Target, Package, Bike, Truck, Activity, Lightbulb, CheckCircle2 } from "lucide-react";

interface Props { kpi: ProductivityKpi | null; isLoading?: boolean; filterLabel?: string; }

function ProgressBar({
  value,
  max = 100,
  color = "blue",
  heightClass = "h-1.5",
}: {
  value: number;
  max?: number;
  color?: string;
  heightClass?: string;
}) {
  const pct = Math.max(0, Math.min((value / max) * 100, 100));
  const colors: Record<string, string> = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };
  return (
    <div className={`mt-1.5 ${heightClass} bg-gray-200 rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.blue}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getThresholdStatus(ach: number): {
  label: string;
  color: "green" | "yellow" | "red";
  textClass: string;
  badgeClass: string;
} {
  if (ach >= 100) {
    return {
      label: "Achieved",
      color: "green",
      textClass: "text-emerald-600",
      badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    };
  }
  if (ach >= 80) {
    return {
      label: "On Track",
      color: "yellow",
      textClass: "text-amber-700",
      badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
    };
  }
  return {
    label: "Below",
    color: "red",
    textClass: "text-red-600",
    badgeClass: "bg-red-100 text-red-700 border border-red-200",
  };
}

function MitraProductivityCard({
  title,
  subtitle,
  vehicleType,
  segment,
}: {
  title: string;
  subtitle: string;
  vehicleType: "2WH" | "4WH";
  segment: WeeklyMitraSegment;
}) {
  const isGood = segment.isUnderTarget;
  const barColor = isGood ? "green" : "red";
  const pctTextClass = isGood ? "text-emerald-600" : "text-red-600";

  return (
    <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
              {vehicleType === "2WH" ? (
                <Bike className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <Truck className="h-3.5 w-3.5 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 leading-tight">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400">{subtitle}</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/70">
            MITRA
          </span>
        </div>

        {/* Main Value */}
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-gray-900 leading-none">
            {segment.avgProductivity.toFixed(1)}
          </span>
          <span className="text-xs font-medium text-gray-400">pkgs / shift</span>
        </div>

        {/* Progress Bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="text-gray-500">Productivity vs Target</span>
            <span className={`font-bold ${pctTextClass}`}>
              {segment.vsTargetPct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar value={segment.vsTargetPct} color={barColor} heightClass="h-1.5" />
        </div>

        {/* 3 Columns: TOTAL VOL, SHIFTS, TARGET */}
        <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-gray-100 text-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              TOTAL VOL
            </p>
            <p className="text-xs font-bold text-gray-900 mt-0.5">
              {segment.totalDelivered.toLocaleString("id-ID")}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              SHIFTS
            </p>
            <p className="text-xs font-bold text-gray-900 mt-0.5">
              {segment.shifts.toLocaleString("id-ID")}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              TARGET
            </p>
            <p className="text-xs font-bold text-gray-900 mt-0.5">
              {segment.target}
            </p>
          </div>
        </div>

        {/* Under / Over Target Badge */}
        <div className="mt-2">
          {isGood ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingDown className="h-3 w-3" />
              Under Target ✓
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
              <TrendingUp className="h-3 w-3" />
              Over Target ✕
            </span>
          )}
        </div>
      </div>

      <p className="text-[10px] italic text-gray-400 mt-2.5 pt-1.5 border-t border-gray-100">
        Formula: Avg Deliv ÷ Target × 100 | Over = buruk
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-pulse">
      <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
      <div className="h-6 w-16 bg-gray-200 rounded mb-2" />
      <div className="h-1.5 bg-gray-100 rounded" />
    </div>
  );
}

export function ProductivityKpiCards({ kpi, isLoading, filterLabel }: Props) {
  if (isLoading || !kpi) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const prodColor = kpi.weeklyAvgProductivity.progress >= 100 ? "green"
    : kpi.weeklyAvgProductivity.progress >= 90 ? "yellow" : "red";

  const afterThreshold = kpi.afterThreshold;
  const kpi2wStatus = afterThreshold ? getThresholdStatus(afterThreshold.kpi2w.achievement) : null;
  const ded2wStatus = afterThreshold ? getThresholdStatus(afterThreshold.kpi2w.dedicated2wh.achievement) : null;
  const kp2wStatus  = afterThreshold ? getThresholdStatus(afterThreshold.kpi2w.kurirPlus2wh.achievement) : null;
  const kpi4wStatus = afterThreshold ? getThresholdStatus(afterThreshold.kpi4w.achievement) : null;

  return (
    <div className="space-y-4">
      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Weekly Avg Productivity */}
        <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Weekly Avg Productivity</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 leading-tight">
                {kpi.weeklyAvgProductivity.value}
                <span className="text-xs font-normal text-gray-400 ml-1">/ shift</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Target: <span className="font-medium">{kpi.weeklyAvgProductivity.target}</span>
                {" · "}
                <span className={prodColor === "green" ? "text-green-600 font-bold" : prodColor === "yellow" ? "text-yellow-600 font-bold" : "text-red-600 font-bold"}>
                  {kpi.weeklyAvgProductivity.progress}%
                </span>
              </p>
              <ProgressBar value={kpi.weeklyAvgProductivity.progress} color={prodColor} />
              <p className="text-[10px] text-gray-400 mt-1">
                {kpi.weeklyAvgProductivity.totalDelivered.toLocaleString("id-ID")} deliv · {kpi.weeklyAvgProductivity.activeShifts} shifts
              </p>
            </div>
            <div className="ml-2 w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Daily Active */}
        <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Daily Active Rate</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 leading-tight">
                {kpi.dailyActive.value}
                <span className="text-xs font-normal text-gray-400 ml-1">%</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                2WH · Dedicated + Kurir Plus
              </p>
              <ProgressBar value={kpi.dailyActive.value} color={kpi.dailyActive.value >= 90 ? "green" : kpi.dailyActive.value >= 80 ? "yellow" : "red"} />
              <p className="text-[10px] text-gray-400 mt-1">
                {kpi.dailyActive.uniqueHeadcount} kurir · {kpi.dailyActive.operatingDays} hari · avg {kpi.dailyActive.avgCouriersPerDay}/hr
              </p>
            </div>
            <div className="ml-2 w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="h-4 w-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Met Quota */}
        <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Met Quota</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 leading-tight">
                {kpi.metQuota.count}
                <span className="text-sm font-normal text-gray-400">/{kpi.metQuota.total}</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                <span className={kpi.metQuota.pct >= 50 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                  {kpi.metQuota.pct}%
                </span>
                {" kurir capai target"}
              </p>
              <ProgressBar value={kpi.metQuota.pct} color={kpi.metQuota.pct >= 70 ? "green" : kpi.metQuota.pct >= 50 ? "yellow" : "red"} />
            </div>
            <div className="ml-2 w-7 h-7 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Delivered</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 leading-tight">
                {kpi.summary.totalDelivered.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Success: <span className="font-semibold text-green-600">{kpi.summary.successRate}%</span>
              </p>
              <ProgressBar value={kpi.summary.successRate} color={kpi.summary.successRate >= 95 ? "green" : "yellow"} />
              <p className="text-[10px] text-gray-400 mt-1">
                {kpi.summary.totalFailed} fail · {kpi.summary.totalOnhold} onhold
              </p>
            </div>
            <div className="ml-2 w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* AFTER THRESHOLD & OPERATIONAL CARDS (3-COLUMN COMPACT GRID) */}
      {afterThreshold && kpi2wStatus && ded2wStatus && kp2wStatus && kpi4wStatus && (
        <div className="space-y-3">
          {/* Section Divider */}
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-300/80 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              AFTER THRESHOLD & OPERATIONAL INSIGHTS
            </span>
          </div>

          {/* 3-Column Grid: 6 cards fit into 2 compact rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 1. ACHIEVEMENT KPI PRODUCTIVITY (2W) */}
            <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
                      <Bike className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 leading-tight">
                        ACHIEVEMENT KPI (2W)
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Threshold: 75% Target
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/70">
                    2WH
                  </span>
                </div>

                {/* Big Number + Status Badge */}
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className={`text-2xl font-extrabold ${kpi2wStatus.textClass} leading-none`}>
                    {afterThreshold.kpi2w.achievement.toFixed(1)}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">%</span>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${kpi2wStatus.badgeClass}`}>
                    {kpi2wStatus.label}
                  </span>
                </div>

                {/* Main Progress Bar */}
                <ProgressBar
                  value={afterThreshold.kpi2w.achievement}
                  color={kpi2wStatus.color}
                  heightClass="h-1.5"
                />

                {/* 2 Sub-cards: Dedicated 2WH & Kurir Plus 2WH */}
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  {/* Dedicated 2WH */}
                  <div className="bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-700/80 rounded-lg p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-600 dark:text-slate-300">Ded. 2WH</span>
                      <span className={`font-bold ${ded2wStatus.textClass}`}>
                        {afterThreshold.kpi2w.dedicated2wh.achievement.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={afterThreshold.kpi2w.dedicated2wh.achievement}
                      color={ded2wStatus.color}
                      heightClass="h-1"
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                      <span>avg {afterThreshold.kpi2w.dedicated2wh.avgProductivity.toFixed(1)}</span>
                      <span>tgt {afterThreshold.kpi2w.dedicated2wh.target.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Kurir Plus 2WH */}
                  <div className="bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-700/80 rounded-lg p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-600 dark:text-slate-300">Plus 2WH</span>
                      <span className={`font-bold ${kp2wStatus.textClass}`}>
                        {afterThreshold.kpi2w.kurirPlus2wh.achievement.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={afterThreshold.kpi2w.kurirPlus2wh.achievement}
                      color={kp2wStatus.color}
                      heightClass="h-1"
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                      <span>avg {afterThreshold.kpi2w.kurirPlus2wh.avgProductivity.toFixed(1)}</span>
                      <span>tgt {afterThreshold.kpi2w.kurirPlus2wh.target.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] italic text-gray-400 mt-2.5 pt-1.5 border-t border-gray-100">
                Formula: (Result − Tgt×75%) ÷ (Tgt − Tgt×75%)
              </p>
            </div>

            {/* 2. ACHIEVEMENT KPI PRODUCTIVITY (4W) */}
            <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center flex-shrink-0">
                      <Truck className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 leading-tight">
                        ACHIEVEMENT KPI (4W)
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Threshold: 75% Target
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/70">
                    4WH
                  </span>
                </div>

                {/* Big Number + Status Badge */}
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <span className={`text-2xl font-extrabold ${kpi4wStatus.textClass} leading-none`}>
                    {afterThreshold.kpi4w.achievement.toFixed(1)}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">%</span>
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${kpi4wStatus.badgeClass}`}>
                    {kpi4wStatus.label}
                  </span>
                </div>

                {/* Main Progress Bar */}
                <ProgressBar
                  value={afterThreshold.kpi4w.achievement}
                  color={kpi4wStatus.color}
                  heightClass="h-1.5"
                />

                {/* 1 Sub-card: Dedicated 4WH */}
                <div className="mt-2.5">
                  <div className="bg-slate-50/70 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-700/80 rounded-lg p-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-600 dark:text-slate-300">Dedicated 4WH</span>
                      <span className={`font-bold ${kpi4wStatus.textClass}`}>
                        {afterThreshold.kpi4w.dedicated4wh.achievement.toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={afterThreshold.kpi4w.dedicated4wh.achievement}
                      color={kpi4wStatus.color}
                      heightClass="h-1"
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                      <span>avg {afterThreshold.kpi4w.dedicated4wh.avgProductivity.toFixed(1)}</span>
                      <span>tgt {afterThreshold.kpi4w.dedicated4wh.target.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] italic text-gray-400 mt-2.5 pt-1.5 border-t border-gray-100">
                Formula: (Result − Tgt×75%) ÷ (Tgt − Tgt×75%)
              </p>
            </div>

            {/* 3. ALLOCATION DEDICATED & PLUS */}
            <Allocation2whCard allocation={afterThreshold.allocation2wh} />

            {/* 4. PRODUCTIVITY RIDER MITRA */}
            <MitraProductivityCard
              title="PRODUCTIVITY RIDER MITRA"
              subtitle="Mitra · 2WH · Under target = baik"
              vehicleType="2WH"
              segment={afterThreshold.riderMitra}
            />

            {/* 5. PRODUCTIVITY DRIVER MITRA */}
            <MitraProductivityCard
              title="PRODUCTIVITY DRIVER MITRA"
              subtitle="Mitra · 4WH · Under target = baik"
              vehicleType="4WH"
              segment={afterThreshold.driverMitra}
            />

            {/* 6. ACTION PLAN */}
            {afterThreshold.actionPlan && (
              <ActionPlanCard actionPlan={afterThreshold.actionPlan} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Allocation2whCard({ allocation }: { allocation: WeeklyAllocation2wh }) {
  const maxProd = Math.max(allocation.plusProd, allocation.dedicatedProd, 1);
  const plusBarPct = Math.min(100, (allocation.plusProd / maxProd) * 100);
  const dedBarPct  = Math.min(100, (allocation.dedicatedProd / maxProd) * 100);

  return (
    <div className="hover-lift bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center flex-shrink-0">
              <Activity className="h-3.5 w-3.5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 leading-tight">
                ALLOCATION DED. & PLUS
              </h3>
              <p className="text-[10px] text-slate-400">
                Ratio: 2W Plus ÷ 2W Ded.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/80">
            2WH FLEET
          </span>
        </div>

        {/* Big Ratio Value */}
        <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl font-extrabold text-gray-900 leading-none">
            {allocation.ratioPct.toFixed(1)}%
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {allocation.diffPct.toFixed(1)}% diff
          </span>
        </div>

        {/* Comparison Bars */}
        <div className="mt-2.5 space-y-2">
          {/* 2W Kurir Plus */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="inline-flex items-center gap-1 font-semibold text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                2W Plus
              </span>
              <span className="font-semibold text-gray-700">
                {allocation.plusProd.toFixed(1)} pkgs/shift
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-700"
                style={{ width: `${plusBarPct}%` }}
              />
            </div>
          </div>

          {/* 2W Dedicated */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                2W Ded.
              </span>
              <span className="font-semibold text-gray-700">
                {allocation.dedicatedProd.toFixed(1)} pkgs/shift
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-700 transition-all duration-700"
                style={{ width: `${dedBarPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2 Columns: PLUS PROD & DEDICATED PROD */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-gray-100 text-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              PLUS PROD
            </p>
            <p className="text-xs font-bold text-gray-900 mt-0.5">
              {allocation.plusProd.toFixed(1)} /shift
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">
              DED. PROD
            </p>
            <p className="text-xs font-bold text-gray-900 mt-0.5">
              {allocation.dedicatedProd.toFixed(1)} /shift
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2.5 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
        <span className="italic">(2W Plus ÷ 2W Ded) × 100</span>
        <span className="px-1.5 py-0.2 rounded font-semibold bg-blue-50 text-blue-600 border border-blue-200/80">
          2wh
        </span>
      </div>
    </div>
  );
}

function ActionPlanCard({ actionPlan }: { actionPlan: WeeklyActionPlan }) {
  const items = [actionPlan.riderDed, actionPlan.riderPlus, actionPlan.driverDed];

  return (
    <div className="hover-lift bg-white dark:bg-slate-800/95 rounded-xl border border-slate-200/80 dark:border-slate-700/80 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 leading-tight">
                ACTION PLAN
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">
                Target besok agar avg = target
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/60">
            PLAN
          </span>
        </div>

        {/* 3 Action Plan Items (Compact) */}
        <div className="mt-2.5 space-y-2">
          {items.map((item) => {
            const isCatchUp = item.status === "Catch Up";
            return (
              <div
                key={item.title}
                className="rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/90 p-2.5 space-y-1.5"
              >
                {/* Title & Status Badge */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 inline-block" />
                    <span className="font-bold text-slate-800 dark:text-slate-100">{item.title}</span>
                  </div>
                  {isCatchUp ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60">
                      <TrendingUp className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" />
                      Catch Up
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
                      On Track
                    </span>
                  )}
                </div>

                {/* Numbers: Target Besok vs Avg skrg */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400">BESOK:</span>
                    <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 leading-none">
                      {item.targetBesok}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">pkgs</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Avg: <strong className="text-blue-600 dark:text-blue-400 font-bold">{item.avgSkrg.toFixed(1)}</strong></span>
                    <span className="text-slate-400 dark:text-slate-500 ml-1">/ {item.target}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-700"
                    style={{ width: `${item.progressPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formula Footer */}
      <p className="text-[10px] italic text-gray-400 dark:text-slate-400 mt-2.5 pt-1.5 border-t border-gray-100 dark:border-slate-700/60">
        Tgt Besok = Tgt × (Hari+1) − Avg × Hari
      </p>
    </div>
  );
}

// ============================================================
// Struktur data Productivity — port dari repo Dashboard SPX Soko
// ============================================================

/**
 * Satu baris data kurir harian dari sheet PRODUCTIVITY_RAW
 * Index kolom harus sama persis dengan header sheet.
 */
export interface CourierRecord {
  // [0]–[7] Identifikasi
  district: string;
  courier_id: string;
  courier_name: string;
  date: string;              // MM/DD/YYYY (format US, sama dengan repo Soko)
  driver_name: string;
  contract_type: string;     // "Dedicated" | "Kurir Plus" | "Mitra"
  vehicle_type: string;      // "2WH" | "4WH"
  zone_id: string;

  // [8]–[20] Metrics
  assigned: number | null;
  assigned_target: number | null;
  assigned_progress: number | null;
  delivery_progress: number | null;
  handed_over: number | null;
  delivered: number | null;
  delivered_pct: number | null;
  delivering_count: number | null;
  delivering_pct: number | null;
  failed_delivery: number | null;
  failed_delivery_pct: number | null;
  stuck_at_delivering: number | null;
  onhold: number | null;

  // [21]–[23] Metadata
  nama_hub: string;
  submitted_at?: string;
  submitted_by?: string;
}

/** Target appeal per minggu/contract/vehicle/hub */
export interface TargetAppeal {
  week_start: string;        // YYYY-MM-DD (Senin)
  nama_hub: string;
  contract_type: string;
  vehicle_type: string;
  target: number;
  created_at?: string;
  created_by?: string;
}

export interface WeeklyThresholdSegment {
  avgProductivity: number;
  target: number;
  threshold75: number;
  achievement: number;
  totalDelivered: number;
  shifts: number;
}

export interface WeeklyMitraSegment {
  avgProductivity: number;
  target: number;
  vsTargetPct: number;
  totalDelivered: number;
  shifts: number;
  isUnderTarget: boolean;
}

export interface WeeklyAllocation2wh {
  ratioPct: number;
  diffPct: number;
  plusProd: number;
  dedicatedProd: number;
}

export interface WeeklyActionPlanItem {
  title: string;
  targetBesok: number;
  avgSkrg: number;
  target: number;
  status: "Catch Up" | "On Track";
  progressPct: number;
  operatingDays: number;
}

export interface WeeklyActionPlan {
  riderDed: WeeklyActionPlanItem;
  riderPlus: WeeklyActionPlanItem;
  driverDed: WeeklyActionPlanItem;
}

/** KPI summary untuk weekly/monthly dashboard */
export interface ProductivityKpi {
  weeklyAvgProductivity: {
    value: number;
    target: number;
    progress: number;         // %
    totalDelivered: number;
    activeShifts: number;
  };
  dailyActive: {
    value: number;            // %
    activeShifts: number;
    uniqueHeadcount: number;
    operatingDays: number;
    avgCouriersPerDay: number;
  };
  metQuota: {
    count: number;
    total: number;
    pct: number;
  };
  summary: {
    totalDelivered: number;
    totalHandedOver: number;
    successRate: number;
    totalFailed: number;
    totalOnhold: number;
  };
  afterThreshold?: {
    kpi2w: {
      achievement: number;
      dedicated2wh: WeeklyThresholdSegment;
      kurirPlus2wh: WeeklyThresholdSegment;
    };
    kpi4w: {
      achievement: number;
      dedicated4wh: WeeklyThresholdSegment;
    };
    riderMitra: WeeklyMitraSegment;
    driverMitra: WeeklyMitraSegment;
    allocation2wh: WeeklyAllocation2wh;
    actionPlan: WeeklyActionPlan;
  };
  missingWeekTarget?: boolean;
}

export interface CourierDailyDetail {
  dateKey: string;
  dateLabel: string;
  dayKey: "sen" | "sel" | "rab" | "kam" | "jum" | "sab" | "min";
  dayName: string;
  zone_id: string;
  assigned: number;
  handed_over: number;
  delivered: number;
  failed_delivery: number;
  onhold: number;
  successRate: number;
  productivityPct: number;
}

/** Satu baris di tabel kurir (hasil agregasi) */
export interface CourierScheduleRow {
  courier_id: string;
  courier_name: string;
  district: string;
  zone_id: string;
  contract_type: string;
  vehicle_type: string;
  shiftsCount: number;
  totalAssigned?: number;
  totalDelivered: number;
  totalHandedOver: number;
  totalFailed?: number;
  totalOnhold?: number;
  avgDaily: number;
  target: number;
  productivityPct: number;
  successRate: number;
  activeDays: {
    sen: boolean; sel: boolean; rab: boolean; kam: boolean;
    jum: boolean; sab: boolean; min: boolean;
  };
  dailyDetails?: CourierDailyDetail[];
}

/** Static fallback targets (dari repo Soko) */
export const DEFAULT_TARGETS: Record<string, Record<string, number>> = {
  Dedicated:    { "2WH": 260.97, "4WH": 78.75 },
  "Kurir Plus": { "2WH": 192.20 },
  Mitra:        { "2WH": 41,     "4WH": 50 },
};

export function getDefaultTarget(contract: string, vehicle: string): number {
  return DEFAULT_TARGETS[contract]?.[vehicle]
    ?? (vehicle === "4WH" ? 78.75 : 192.20);
}

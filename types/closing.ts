// ============================================================
// Struktur data dari FMS screenshot (Operation Progress + Ringkasan Hub)
// Index kolom WAJIB sama dengan header DATA_CLOSING di Sheets
// ============================================================

export interface ClosingData {
  // [0] [1]
  tanggal: string;       // YYYY-MM-DD — otomatis dari tanggal submit
  nama_hub: string;      // otomatis dari email user (USER_MAPPING)

  // [2]–[5] In Hub Status (kolom Volume) — dari Operation Progress
  in_hub_transported: number | null;
  in_hub_received: number | null;
  in_hub_assigning: number | null;
  in_hub_assigned: number | null;

  // [6]–[9] Fleet Status — dari Operation Progress
  fleet_delivering: number | null;   // Volume
  fleet_delivered: number | null;    // Volume (Total = "-")
  fleet_oh_volume: number | null;    // On-hold Volume
  fleet_oh_total: number | null;     // On-hold Total

  // [10]–[14] Fleet Head Counts — dari Operation Progress
  dedicated_actual_2wh: number | null;
  kurir_plus_actual_2wh: number | null;
  dedicated_actual_4wh: number | null;
  mitra_actual_2wh: number | null;
  mitra_actual_4wh: number | null;

  // [15]–[19] Backlog — dari Ringkasan Hub
  backlog_total: number | null;         // angka di tengah donut chart
  backlog_to_buyer: number | null;      // sum kolom "To Buyer" semua ageing
  backlog_to_seller: number | null;     // sum kolom "To Seller" semua ageing
  backlog_to_transfer: number | null;   // sum kolom "To Transfer" semua ageing

  // [19]–[21] Expedite — dari Ringkasan Hub
  expedite?: number | null;             // (deprecated)
  super_expedite?: number | null;       // (deprecated)
  total_expedite: number | null;        // angka di tengah donut "To Expedite"

  // [24]–[25] Parcel Sweeper — dari halaman Parcel Sweeper Task
  parcel_sweeper_total: number | null;       // Total Expected Order
  parcel_sweeper_scanned_pct: number | null; // Persentase Expected Order Scanned (%)

  // Computed Volume & Backlog %
  total_volume?: number | null;              // Total In Hub + Fleet (Transported+Received+Assigning+Assigned+Delivering+Delivered+OH Volume)
  backlog_pct?: number | null;               // (backlog_total / total_volume) * 100

  // Daily Productivity (dihitung otomatis dari data yang diupload di menu Productivity)
  prod_2w_dedicated?: number | null;
  prod_2w_kurir_plus?: number | null;
  prod_4w_dedicated?: number | null;
  prod_2w_mitra?: number | null;
  prod_4w_mitra?: number | null;

  // Target harian untuk masing-masing tipe (digunakan untuk indikator warna hijau/merah)
  target_2w_dedicated?: number | null;
  target_2w_kurir_plus?: number | null;
  target_4w_dedicated?: number | null;
  target_2w_mitra?: number | null;
  target_4w_mitra?: number | null;

  // [26] Daftar nama field yang diketik/diedit secara manual oleh user (comma-separated)
  manual_fields?: string[];

  // [22] [23]
  submitted_at?: string;
  submitted_by?: string;
}

export interface UserMapping {
  email: string;
  nama_hub: string;
  nama_user: string;
  status: "active" | "inactive";
  avatar_url?: string;
}

export interface KpiSummary {
  totalDelivered: number;
  totalOnhold: number;
  totalBacklog: number;
  hubUpdated: number;
  hubTotal: number;
}

export type AnomalyField = {
  field: keyof ClosingData;
  reason: string;
};

export interface ClosingRowWithAnomalies extends Partial<ClosingData> {
  anomalies: AnomalyField[];
}

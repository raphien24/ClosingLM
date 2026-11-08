import { ClosingData } from "@/types/closing";
import { format } from "date-fns";

// ── Parse angka dari string OCR ───────────────────────────────
// Handle semua format: 9.229 / 9,229 / 9229 / 1.460 / 84,3%
export function parseNumber(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return null;
  let s = raw.trim().replace(/[%\s]/g, "");
  if (s.includes(".") && s.includes(",")) {
    // 1.234,56 → 1234.56 (format Eropa)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    const parts = s.split(",");
    // "84,3" → desimal; "1,460" → ribuan
    s = parts[1]?.length <= 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(".")) {
    const parts = s.split(".");
    // "9.229" → ribuan (3 digit setelah titik); "9.2" → desimal
    if (parts[1]?.length > 2) s = s.replace(/\./g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Deteksi tanggal dari teks OCR / Copy FMS ────────────────
// Tanggal hanya dideteksi dan divalidasi dari halaman Parcel Sweeper:
// 1. "Tanggal: YYYY-MM-DD" (di halaman Parcel Sweeper)
// 2. Kode Parcel Sweeper Task ID: "PS20261106856489" → 2026-11-06
// Sedangkan halaman utama FMS (Ringkasan Hub / Operation Progress) diabaikan tanggalnya
// karena sering memiliki teks prediksi "Updated: 6 Nov 13:26 (Data dari 7 Nov...)".
export function detectDate(text: string): string | null {
  const dates = detectParcelSweeperDates(text);
  return dates[0] ?? null;
}

/**
 * Ekstrak tanggal khusus dari halaman Parcel Sweeper (untuk validasi wajib = hari ini).
 * Mengembalikan array kosong jika teks bukan berasal dari halaman Parcel Sweeper.
 */
/** Apakah teks berasal dari halaman Parcel Sweeper (perlu validasi tanggal wajib hari ini). */
export function isParcelSweeperPage(text: string): boolean {
  return /Parcel\s+Sweeper|Expected\s+Order\s+Scanned|\bPS20\d{6,}/i.test(text);
}
export function detectParcelSweeperDates(text: string): string[] {
  if (!/Parcel\s+Sweeper|Expected\s+Order\s+Scanned|\bPS20\d{6,}/i.test(text)) {
    return [];
  }

  // Abaikan watermark timestamp sistem (misal "com/2026-11-07 18:51:33")
  const cleaned = text.replace(/(?:spxexpress\.com|\.com)\/\d{4}-\d{2}-\d{2}/gi, "");
  const found = new Set<string>();

  // 1. Format eksplisit "Tanggal: YYYY-MM-DD"
  for (const m of cleaned.matchAll(/Tanggal\s*:?\s*(20\d{2})[\/\-](0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])\b/gi)) {
    found.add(`${m[1]}-${m[2]}-${m[3]}`);
  }

  // 2. Kode Parcel Sweeper Task ID: PSYYYYMMDD... (misal PS20261106856489)
  for (const m of cleaned.matchAll(/\bPS(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3,}\b/g)) {
    found.add(`${m[1]}-${m[2]}-${m[3]}`);
  }

  // 3. Format "DD MMM YYYY" (misal "8 Nov 2026") - nama bulan ID/EN
  const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", may: "05", jun: "06", jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10", nov: "11", des: "12", dec: "12" };
  for (const m of cleaned.matchAll(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/g)) {
    const mm = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mm) found.add(`${m[3]}-${mm}-${m[1].padStart(2, "0")}`);
  }

  // 4. Format "Tanggal: DD/MM/YYYY" atau "DD-MM-YYYY"
  for (const m of cleaned.matchAll(/Tanggal\s*:?\s*(0[1-9]|[12]\d|3[01])[\/\-](0[1-9]|1[0-2])[\/\-](20\d{2})\b/gi)) {
    found.add(`${m[3]}-${m[2]}-${m[1]}`);
  }
  return Array.from(found);
}

// ── Cari angka pertama setelah sebuah label ───────────────────
function after(text: string, label: string): number | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Cari label lalu ambil angka pertama setelahnya (max 40 char)
  const m = text.match(new RegExp(esc + "[^\\d\\n]{0,40}?([\\d][\\d.,]*)", "i"));
  return m ? parseNumber(m[1]) : null;
}

// ── Cari baris yang mengandung label, return baris tersebut ──
function lineWith(text: string, label: string): string | null {
  const lines = text.split(/\r?\n/);
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "i");
  return lines.find((l) => re.test(l)) ?? null;
}

// ── Ekstrak semua angka dari sebuah string ────────────────────
function allNumbers(s: string): number[] {
  return (s.match(/\d[\d.,]*/g) || [])
    .map(parseNumber)
    .filter((n): n is number => n !== null);
}

/** Angka rasio "X/Y": tanda "-" di FMS berarti kosong -> 0. */
const ratioNum = (n: string): number | null => (n.trim() === "-" ? 0 : parseNumber(n));

/** Nilai "-" di FMS berarti kosong -> hasil OCR = 0 (bila tidak ada angka). */
function dashToZero(segment: string, value: number | null): number | null {
  if (value !== null) return value;
  return /(^|[\s(])-(?=[\s)/%]|$)/.test(segment) ? 0 : null;
}

// ── Parse OCR text dari FMS "Operation Progress" ─────────────
//
// Layout tabel FMS yang diharapkan di OCR output:
//
// In Hub Status:
//   Transported   [Vol]  [Total]  [Selesai%]  → ambil Vol (kolom 1)
//   Received      [Vol]  [Total]  [Selesai%]  → ambil Vol (kolom 1)
//   Assigning     [Vol]  [Total]  [Selesai%]  → ambil Vol (kolom 1)
//   Assigned      [Vol]  [Total]  [Selesai%]  → ambil Vol (kolom 1)
//
// Fleet Status:
//   Delivering    [Vol]  [Total]  [Selesai%]  → ambil TOTAL (kolom 2)
//   Delivered     [Vol]  -        -(%)        → ambil Vol  (kolom 1), Total = "-"
//   On hold       [Vol]  [Total]  [X(Y%)]     → ambil TOTAL (kolom 2)
//
// Fleet Head Counts:
//   2WH   Dedicated X/Y   Kurir Plus X/Y   Mitra X/Y  → ambil X (angka pertama)
//   4WH   Dedicated X/Y   Kurir Plus X/Y   Mitra X/Y  → ambil X (angka pertama)
//
export function parseOcrText(rawText: string): {
  row: Partial<ClosingData>;
  tanggal_detected: string | null;
} {
  const text = rawText;
  const tanggal_detected = detectDate(text);

  // Deteksi apakah halaman ini adalah halaman khusus "Parcel Sweeper"
  // (di halaman Parcel Sweeper, tabel resi memiliki kata "Received", "BackLog", "OnHold", "Expedite Tag"
  //  yang TIDAK BOLEH salah masuk ke In Hub Status / Backlog / Expedite!)
  const isParcelSweeperPage =
    /Parcel\s+Sweeper|Expected\s+Order\s+Scanned|\bPS20\d{6,}/i.test(text) &&
    !/Operation\s+Progress|In\s+Hub\s+Status|Ringkasan\s+Hub/i.test(text);

  // ── Parcel Sweeper ───────────────────────────────────────
  const { parcel_sweeper_total, parcel_sweeper_scanned_pct } = extractParcelSweeper(text);

  if (isParcelSweeperPage) {
    return {
      row: {
        parcel_sweeper_total,
        parcel_sweeper_scanned_pct,
      },
      tanggal_detected,
    };
  }

  // ── In Hub Status ────────────────────────────────────────
  // Ambil kolom Volume (angka pertama di baris tersebut)
  const in_hub_transported = extractInHubVolume(text, "Transported");
  const in_hub_received    = extractInHubVolume(text, "Received");
  const in_hub_assigning   = extractInHubVolume(text, "Assigning");
  const in_hub_assigned    = extractInHubVolume(text, "Assigned");

  // ── Fleet Status ─────────────────────────────────────────
  const fleet_delivering = extractFleetDelivering(text);
  const fleet_delivered  = extractFleetDelivered(text);
  const { oh_volume, oh_total } = extractOnHold(text);

  // ── Fleet Head Counts (2WH dan 4WH) ──────────────────────
  const fleetCounts = extractFleetHeadCounts(text);

  // ── Backlog (Ringkasan Hub) ───────────────────────────────
  // Hanya ambil angka total Backlog (dari jumlah tabel Aging saat Ctrl+A atau tengah donut saat OCR)
  const { backlog_total } = extractBacklog(text);

  // ── Expedite (Ringkasan Hub) ─────────────────────────────
  // Hanya ambil angka Total Expedite (di tengah donut "To Expedite")
  const { total_expedite } = extractExpedite(text);

  const row: Partial<ClosingData> = {
    in_hub_transported,
    in_hub_received,
    in_hub_assigning,
    in_hub_assigned,
    fleet_delivering,
    fleet_delivered,
    fleet_oh_volume:        oh_volume,
    fleet_oh_total:         oh_total,
    dedicated_actual_2wh:   fleetCounts.dedicated_2wh,
    kurir_plus_actual_2wh:  fleetCounts.kurir_plus_2wh,
    dedicated_actual_4wh:   fleetCounts.dedicated_4wh,
    mitra_actual_2wh:       fleetCounts.mitra_2wh,
    mitra_actual_4wh:       fleetCounts.mitra_4wh,
    backlog_total,
    total_expedite,
    parcel_sweeper_total,
    parcel_sweeper_scanned_pct,
  };

  return { row, tanggal_detected };
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * In Hub Status: cari baris label, ambil angka pertama (= kolom Volume)
 * Format baris: "Transported   2   9.229   9.227(100%) ---"
 * Atau di teks copy-paste FMS, label bisa berdiri sendiri di satu baris dan angka di baris berikutnya.
 */
function extractInHubVolume(text: string, label: string): number | null {
  const lines = text.split(/\r?\n/);
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${esc}\\b`, "i");

  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    const sameLine = allNumbers(lines[i].replace(re, ""));
    if (sameLine.length > 0) return sameLine[0];
    // Jika di baris yang sama tidak ada angka (misal copy-paste tabel vertikal), cek 1-2 baris setelahnya
    const nextBlock = [lines[i + 1] || "", lines[i + 2] || ""].join(" ");
    const nextNums = allNumbers(nextBlock);
    if (nextNums.length > 0) return nextNums[0];
  }
  return null;
}

/**
 * Fleet Status Delivering: ambil kolom VOLUME (angka ke-1)
 * Format: "Delivering   0   4.448   4.448(100,0%)---"
 *          Vol=0, Total=4.448 → ambil Volume (angka pertama)
 */
function extractFleetDelivering(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const re = /\bDelivering\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    // Hindari "First Delivering Time", "Stuck at Delivering", atau "Delivering attempted"
    if (/first|stuck|attempted/i.test(lines[i])) continue;
    let nums = allNumbers(lines[i].replace(re, ""));
    if (!nums.length) {
      const combined = [lines[i + 1] || "", lines[i + 2] || ""].join(" ");
      nums = allNumbers(combined);
    }
    if (nums.length) return nums[0];
    // Nilai "-" di FMS = 0
    if (dashToZero(lines[i], null) !== null) return 0;
  }
  return null;
}

/**
 * Fleet Delivered: ambil kolom VOLUME (angka ke-1) di tabel Fleet Status
 * karena kolom Total = "-"
 * Format: "Delivered   1.057   -   -(%)---"
 *          Vol=1.057, Total="-" → ambil Volume
 * Hindari salah cocok dengan "Total Delivered to Buyer" di bagian atas Ringkasan Hub!
 */
function extractFleetDelivered(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const re = /\bDelivered\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    // Skip kartu "Total Delivered to Buyer" atau "Delivered (%)"
    if (/buyer|total\s+delivered|delivered\s*\(/i.test(lines[i])) continue;
    let nums = allNumbers(lines[i].replace(re, ""));
    if (!nums.length) {
      nums = allNumbers([lines[i + 1] || "", lines[i + 2] || ""].join(" "));
    }
    if (nums.length) return nums[0];
  }
  return null;
}

/**
 * On-hold: ambil kolom VOLUME (ke-1) dan TOTAL (ke-2)
 * Format: "On hold   12   13   1(7,7%)---"
 *          Vol=12, Total=13
 * Toleran terhadap salah baca OCR: "On hold", "Onhold", "0n hold", "On-hold"
 */
function extractOnHold(text: string): { oh_volume: number | null; oh_total: number | null } {
  const lines = text.split(/\r?\n/);
  const re = /\b[o0]n[\s\-]*h[o0]ld\b/i;
  const idx = lines.findIndex((l) => re.test(l));
  if (idx === -1) return { oh_volume: null, oh_total: null };

  let nums = allNumbers(lines[idx].replace(re, ""));
  if (nums.length < 2) {
    const combined = [lines[idx].replace(re, ""), lines[idx + 1] || "", lines[idx + 2] || ""].join(" ");
    nums = allNumbers(combined);
  }
  return {
    oh_volume: nums[0] ?? null,  // Volume (kiri)
    oh_total:  nums[1] ?? nums[0] ?? null,  // Total (kanan)
  };
}

/**
 * Fleet Head Counts — ekstrak angka pertama dari pola "X/Y"
 *
 * Layout di OCR output biasanya:
 * Baris 2WH: "2WH   17/17   9/9   23/23"
 *             col[0]=Dedicated, col[1]=Kurir Plus, col[2]=Mitra
 * Baris 4WH: "4WH   0/0   0/0   10/10"
 *             col[0]=Dedicated, col[1]=Kurir Plus, col[2]=Mitra
 * Toleran OCR: "2WH" bisa terbaca "ZWH", "2W H", dsb.
 */
function extractFleetHeadCounts(text: string): {
  dedicated_2wh:  number | null;
  kurir_plus_2wh: number | null;
  mitra_2wh:      number | null;
  dedicated_4wh:  number | null;
  mitra_4wh:      number | null;
} {
  const result = {
    dedicated_2wh:  null as number | null,
    kurir_plus_2wh: null as number | null,
    mitra_2wh:      null as number | null,
    dedicated_4wh:  null as number | null,
    mitra_4wh:      null as number | null,
  };

  // Cari section "Fleet Head Counts" terlebih dahulu agar tidak tertukar dengan "Fleet Productivity" (yang juga punya baris 2WH & 4WH!)
  const headCountBlockMatch = text.match(
    /Fleet\s+Head\s+Counts([\s\S]{0,600}?)(?:Fleet\s+Productivity|Keuangan|$)/i
  );
  const hcSource = headCountBlockMatch ? headCountBlockMatch[1] : text;

  // Cari section "2WH"
  const m2wh = hcSource.match(/(?:2|Z)\s*W\s*H([\s\S]{0,180}?)(?:(?:4|A)\s*W\s*H|Lainnya|$)/i);
  if (m2wh) {
    const ratios = [...m2wh[1].matchAll(/((?:\d+|-)\s*\/\s*(?:\d+|-))/g)];
    if (ratios[0]) result.dedicated_2wh  = ratioNum(ratios[0][1]);
    if (ratios[1]) result.kurir_plus_2wh = ratioNum(ratios[1][1]);
    if (ratios[2]) result.mitra_2wh      = ratioNum(ratios[2][1]);
  }

  // Cari section "4WH"
  const m4wh = hcSource.match(/(?:4|A)\s*W\s*H([\s\S]{0,180}?)(?:Lainnya|Fleet\s+Productivity|$)/i);
  if (m4wh) {
    const ratios = [...m4wh[1].matchAll(/((?:\d+|-)\s*\/\s*(?:\d+|-))/g)];
    if (ratios[0]) result.dedicated_4wh = ratioNum(ratios[0][1]);
    // ratios[1] = Kurir Plus 4WH (tidak diperlukan)
    if (ratios[2]) result.mitra_4wh     = ratioNum(ratios[2][1]);
  }

  return result;
}

/**
 * Backlog — angka di tengah donut chart + tabel ageing
 *
 * Catatan penting saat user melakukan Ctrl+A -> Ctrl+C di halaman web FMS:
 * - Grafik Donut (Backlog = 388) dirender menggunakan <canvas>, sehingga angka 388
 *   TIDAK ADA di dalam teks clipboard!
 * - Yang ada di teks clipboard adalah:
 *   1. Legend chart: ">3 Days", "3 Days", "1-2 Days"
 *   2. Tabel Aging di sebelahnya:
 *      Aging | To Buyer | To Seller | To Transfer
 *      >3 Hari   12         0           3
 *      3 Hari    24         0           1
 *      1-2 Hari  339        3           6
 *   Jumlah seluruh sel di tabel Aging (12+0+3 + 24+0+1 + 339+3+6 = 388) SAMA PERSIS
 *   dengan angka di tengah donut chart Backlog (388)!
 */
function extractBacklog(text: string): {
  backlog_total:       number | null;
  backlog_to_buyer:    number | null;
  backlog_to_seller:   number | null;
  backlog_to_transfer: number | null;
} {
  // 1. Ekstrak dari tabel Aging (paling akurat 100% saat Ctrl+A / Ctrl+V)
  // Batasi pencarian di antara "Backlog" dan "To Expedite" / "Operation Progress"
  const backlogBlockMatch = text.match(
    /Backlog([\s\S]{0,2000}?)(?:To\s+Expedite|Operation\s+Progress|$)/i
  );
  if (!backlogBlockMatch) {
    // Gambar ini bukan kartu Backlog (mis. Fleet Head Counts) -> jangan fabrikasi angka
    return { backlog_total: null, backlog_to_buyer: null, backlog_to_seller: null, backlog_to_transfer: null };
  }
  const blockText = backlogBlockMatch[1];

  let to_buyer = 0, to_seller = 0, to_transfer = 0;
  let foundAgingRows = 0;

  // Format 1: per baris mengandung ">3 Hari 12 0 3", "3 Hari 24 0 1", "1-2 Hari 339 3 6"
  // Format 2 (multi-baris saat copy tabel): label ">3 Hari" di satu baris, 3 angka di baris-baris berikutnya
  // Catatan: gunakan lookahead tanpa \b di depan ">" karena ">" bukan word character!
  const agingRowRegex = /(?:>\s*3|\b3|\b1\s*[-–~]\s*2)\s*Hari\b([\s\S]{0,120}?)(?=(?:>\s*3|\b3|\b1\s*[-–~]\s*2)\s*Hari\b|To\s+Expedite|$)/gi;
  for (const m of blockText.matchAll(agingRowRegex)) {
    const rowContent = m[1];
    // Ambil maks 3 angka pertama setelah label "* Hari"
    const nums = allNumbers(rowContent);
    if (nums.length >= 3) {
      to_buyer    += nums[0];
      to_seller   += nums[1];
      to_transfer += nums[2];
      foundAgingRows++;
    } else if (nums.length >= 1) {
      to_buyer    += nums[0];
      to_seller   += nums[1] ?? 0;
      to_transfer += nums[2] ?? 0;
      foundAgingRows++;
    }
  }

  // 2. Ekstrak angka di tengah donut chart (jika ada di OCR gambar)
  // Pada OCR gambar, angka di tengah donut (misal 388) selalu berada di bagian kiri baris (sebelum spasi panjang ke tabel kanan)
  let donut_total: number | null = null;
  const donutLines = blockText.split(/\r?\n/).slice(1); // lewati baris judul "Backlog"
  const leftPieces: string[] = [];
  for (const line of donutLines) {
    // Ambil hanya bagian kiri baris (sebelum 10+ spasi berturut-turut atau kata Aging/Hari)
    const splitWide = line.split(/\s{8,}/)[0] || "";
    const cut = splitWide.search(/Aging|To\s+Buyer|To\s+Seller|To\s+Transfer|(?:>\s*3|\b3|\b1\s*[-–~]\s*2)\s*Hari/i);
    leftPieces.push(cut !== -1 ? splitWide.slice(0, cut) : splitWide);
  }
  const leftOnly = leftPieces.join("\n");
  if (leftOnly) {
    // Hapus baris yang mengandung noise header palsu OCR ("LINER", "Mita Arg", dsb)
    const clean = leftOnly
      .replace(/Updated\s*:?\s*\d{1,2}[ \t]+[A-Za-z]{3,}[ \t]+\d{1,2}:\d{2}/gi, "")
      .replace(/\b\d{1,2}[ \t]+(?:Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)\w*/gi, "")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
      .replace(/>?[ \t]*\d+[ \t]*[-–~]?[ \t]*\d*[ \t]*(?:hari|days?|fawn|crea|joma|han)/gi, "")
      // Hapus kata yang menempel langsung dengan angka tanpa spasi (misal "EE1N")
      .replace(/\b[A-Za-z]+\d+[A-Za-z]*\b/g, "")
      .replace(/\b\d+[A-Za-z]+\b/g, "")
      .replace(/\bLINER[ \t]+\d+\b/gi, "")
      .replace(/\d+(?:[,.]\d+)?[ \t]*%/g, "");

    // Utamakan angka >= 10 yang berada di paling awal baris (kiri)
    const startOfLineMatches = [...clean.matchAll(/^\s*(\d{2,6}(?:[.,]\d{3})*)\b/gm)]
      .map((m) => parseNumber(m[1]))
      .filter((n): n is number => n !== null && n >= 10 && n <= 99999);

    if (startOfLineMatches.length > 0) {
      donut_total = startOfLineMatches[0];
    } else {
      const candidates = (clean.match(/\b(\d{1,6}(?:[.,]\d{3})*)\b/g) || [])
        .map((v) => parseNumber(v))
        .filter((n): n is number => n !== null && n >= 10 && n <= 99999);
      donut_total = candidates[0] ?? null;
    }
  }

  // Jika tabel Aging lengkap terbaca (3 baris: >3 Hari, 3 Hari, 1-2 Hari), jumlah ketiganya = 100% akurat
  if (foundAgingRows >= 3) {
    const sumAging = to_buyer + to_seller + to_transfer;
    return {
      backlog_total:       sumAging,
      backlog_to_buyer:    to_buyer,
      backlog_to_seller:   to_seller,
      backlog_to_transfer: to_transfer,
    };
  }

  // Jika hanya sebagian baris Aging terbaca (misal dari OCR buram), gunakan hanya jika >= 2 baris terbaca
  const sumPartial = foundAgingRows >= 2 ? to_buyer + to_seller + to_transfer : null;
  return {
    backlog_total:       donut_total ?? sumPartial,
    backlog_to_buyer:    foundAgingRows >= 2 ? to_buyer    : null,
    backlog_to_seller:   foundAgingRows >= 2 ? to_seller   : null,
    backlog_to_transfer: foundAgingRows >= 2 ? to_transfer : null,
  };
}

/**
 * Expedite — angka di tengah donut chart "To Expedite"
 *
 * Catatan penting:
 * - Di halaman FMS, di sebelah kanan "To Expedite" ada box "Linehaul Trip" yang berisi
 *   jam (11:22, 12:02) dan angka Order (20, 1.648, 2.300).
 * - Saat Ctrl+A -> Ctrl+C: karena donut "To Expedite" (23) adalah <canvas>, angka 23
 *   tidak ikut ter-copy ke teks clipboard, sehingga jika tidak dibatasi sebelum "Linehaul Trip",
 *   parser akan salah mengambil angka "7" (dari Updated: 7 Nov) atau "20" (dari Linehaul Trip)!
 * - Saat OCR Screenshot: dalam satu baris horizontal, "To Expedite" di kiri dan "Linehaul Trip" di kanan.
 *   Oleh karena itu setiap baris harus dipotong sebelum kolom "Linehaul" atau Trip ID ("LT0...").
 */
function extractExpedite(text: string): {
  total_expedite: number | null;
  expedite:       number | null;
  super_expedite: number | null;
} {
  let total_expedite: number | null = null;

  // Ambil blok mulai dari "To Expedite" sampai sebelum "Operation Progress"
  const expMatch = text.match(/To\s+Expedite([\s\S]{0,1200}?)(?:Operation\s+Progress|$)/i);
  if (expMatch) {
    let rawBlock = expMatch[1];

    // Jika teks berasal dari Ctrl+A / Ctrl+C, "Linehaul Trip" muncul sebagai blok berurutan setelah "Super Expedite".
    // Potong segala sesuatu mulai dari "Linehaul" agar angka Order Linehaul (20, 1.648, 2.300) tidak pernah terbaca!
    const linehaulIdx = rawBlock.search(/Linehaul/i);
    // Cek apakah ini multi-column OCR (di mana "To Expedite" dan "Linehaul Trip" berada di baris pertama yang sama)
    const firstNewline = rawBlock.indexOf("\n");
    const isSideBySideOcr = linehaulIdx !== -1 && (firstNewline === -1 || linehaulIdx < firstNewline);

    if (!isSideBySideOcr && linehaulIdx !== -1) {
      rawBlock = rawBlock.slice(0, linehaulIdx);
    } else if (isSideBySideOcr) {
      // Pada OCR berdampingan:
      // 1. Baris pertama adalah sisa baris judul ("To Expedite ... | Total | Hub | Fleet | Linehaul Trip"), buang baris pertama
      const lines = rawBlock.split(/\r?\n/);
      rawBlock = lines
        .slice(1)
        .map((line) => {
          // 2. Ambil hanya kolom paling kiri (sebelum 8+ spasi berturut-turut yang memisahkan dengan Linehaul Trip di kanan)
          const leftCol = line.split(/\s{8,}/)[0] || "";
          const cut = leftCol.search(/Linehaul|Memuat|Transporting|Trip\s*ID|\bLT[0O]Q|\b\d{1,2}:\d{2}\s+\d{1,2}:\d{2}/i);
          return cut !== -1 ? leftCol.slice(0, cut) : leftCol;
        })
        .join("\n");
    }

    // Bersihkan semua noise: "Updated: 7 Nov 18:48", tanggal, jam, tahun, persentase, dan token alfanumerik (misal "1s")
    const clean = rawBlock
      .replace(/Updated\s*:?\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{1,2}:\d{2}/gi, "")
      .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)\w*/gi, "")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
      .replace(/\b20\d{2}\b/g, "")
      .replace(/\d+(?:[,.]\d+)?\s*%/g, "")
      .replace(/\b[A-Za-z]+\d+[A-Za-z]*\b/g, "")
      .replace(/\b\d+[A-Za-z]+\b/g, "");

    // Utamakan angka >= 1 yang berdiri sendiri di sebuah baris (ciri khas angka tengah donut "23")
    const standaloneMatches = [...clean.matchAll(/^\s*(\d{1,5}(?:[.,]\d{3})*)\s*$/gm)]
      .map((m) => parseNumber(m[1]))
      .filter((n): n is number => n !== null && n >= 1 && n <= 9999);
    if (standaloneMatches.length > 0) {
      total_expedite = standaloneMatches[0];
    } else {
      const candidates = (clean.match(/\b(\d{1,5}(?:[.,]\d{3})*)\b/g) || [])
        .map((v) => parseNumber(v))
        .filter((n): n is number => n !== null && n >= 1 && n <= 9999);
      total_expedite = candidates[0] ?? null;
    }
  }

  let expedite:       number | null = null;
  let super_expedite: number | null = null;

  if (total_expedite !== null) {
    const expSectionPct = text.match(/To\s+Expedite[\s\S]{0,350}/i)?.[0] ?? "";
    const pcts = [...expSectionPct.matchAll(/(\d+(?:[,.]\d+)?)\s*%/g)]
      .map((pm) => parseNumber(pm[1]))
      .filter((n): n is number => n !== null && n >= 0 && n <= 100)
      .sort((a, b) => b - a);

    if (pcts.length >= 1) {
      expedite       = Math.round(total_expedite * (pcts[0] / 100));
      super_expedite = Math.max(0, total_expedite - expedite);
    }
  }

  return { total_expedite, expedite, super_expedite };
}

/**
 * Parcel Sweeper — ekstrak Total dan Persentase Expected Order Scanned (%)
 *
 * Struktur di halaman FMS (Parcel Sweeper Task):
 * - Header: "Parcel Sweeper Task ID: PS20261106856489"
 * - Panel kiri:
 *   - Lingkaran: "100%" / "Expected Order Scanned"
 *   - Tabel ringkas di bawah lingkaran:
 *     Total       260
 *     Unscanned   0
 *     Scanned     260
 * - Panel kanan: Tabel daftar resi (Nomor Resi SPXID..., Scanned Status, Count Type, dll)
 */
function extractParcelSweeper(text: string): {
  parcel_sweeper_total:       number | null;
  parcel_sweeper_scanned_pct: number | null;
} {
  // Pastikan teks memang mengandung halaman Parcel Sweeper
  if (!/Parcel\s+Sweeper|Expected\s+Order\s+Scanned|\bPS20\d{6,}/i.test(text)) {
    return { parcel_sweeper_total: null, parcel_sweeper_scanned_pct: null };
  }

  let total: number | null = null;
  let scanned_pct: number | null = null;

  // 1. Cara Ctrl+A / Ctrl+C (Teks DOM bersih):
  // Cari pola eksplisit "Total <angka> Unscanned <angka> Scanned <angka>"
  const explicitTriple = text.match(
    /\bTotal\s+(\d[\d.,]*)\s+Unscanned\s+(\d[\d.,]*)\s+Scanned\s+(\d[\d.,]*)/i
  );
  if (explicitTriple) {
    total = parseNumber(explicitTriple[1]);
    const unscanned = parseNumber(explicitTriple[2]);
    const scanned   = parseNumber(explicitTriple[3]);
    if (total !== null && total > 0 && scanned !== null) {
      scanned_pct = Math.round((scanned / total) * 1000) / 10;
    } else if (total === 0) {
      scanned_pct = 100;
    } else if (unscanned === 0 && total !== null && total > 0) {
      scanned_pct = 100;
    }
  }

  // Jika persentase juga tertulis langsung sebelum "Expected Order Scanned" (misal "100% Expected Order Scanned" atau OCR "1 00%")
  const explicitPct = text.match(/(\d+(?:[ \t]+\d+)*(?:[.,]\d+)?)[ \t]*%/i);
  if (scanned_pct === null && explicitPct) {
    const p = parseNumber(explicitPct[1].replace(/[ \t]+/g, ""));
    if (p !== null && p >= 0 && p <= 100) scanned_pct = p;
  }

  // Jika Total tertulis setelah kata "Total" sebelum "Unscanned"
  if (total === null) {
    const totalBeforeUnscanned = text.match(/\bTotal\s+(\d[\d.,]*)\s+Unscanned/i);
    if (totalBeforeUnscanned) {
      total = parseNumber(totalBeforeUnscanned[1]);
    }
  }

  // 2. Fallback untuk OCR Screenshot Parcel Sweeper:
  // Di OCR gambar berdampingan, panel kiri (lingkaran 100% + Total 260, Unscanned 0, Scanned 260)
  // berada di sebelah kiri tabel Nomor Resi (SPXID...).
  if (total === null || scanned_pct === null) {
    const lines = text.split(/\r?\n/);
    const leftColumnLines: string[] = [];

    for (const line of lines) {
      // Lewati baris header judul Task ID dan baris pagination paling bawah ("Melompat", "24 / Halaman")
      if (/Parcel\s+Sweeper\s+Task\s+ID|Melompat|Halaman|Pergi\s+ke/i.test(line)) continue;
      // Potong bagian kanan baris mulai dari kolom tabel resi (Nomor Resi, SPXID, LMHub, BackLog, Process for delivery, dll)
      const cut = line.search(
        /Nomor|Momot|SPXID|SPX[I1l0O]|LM\s*Hub|LMI|LMALD|Back\s*Log|BakLog|BarkLon|Process|Count\s+Type|Count\s+Tepe|Next\s+Step|Scanned\s+Status/i
      );
      const leftPart = cut !== -1 ? line.slice(0, cut) : line.slice(0, 42);
      leftColumnLines.push(leftPart);
    }

    const leftText = leftColumnLines.join("\n");

    // Cari persentase di kolom kiri (toleran spasi OCR seperti "1  00%" -> 100%, atau "98,5%")
    if (scanned_pct === null) {
      const pctMatch = leftText.match(/(\d+(?:[ \t]+\d+)*(?:[.,]\d+)?)[ \t]*%/);
      if (pctMatch) {
        const cleanedPct = pctMatch[1].replace(/[ \t]+/g, "");
        const p = parseNumber(cleanedPct);
        if (p !== null && p >= 0 && p <= 100) scanned_pct = p;
      }
    }

    // Cari urutan 3 angka vertikal di kolom kiri: [Total, Unscanned, Scanned]
    // Di mana Total == Unscanned + Scanned (misal [260, 0, 260])
    if (total === null) {
      // Hapus bagian persentase terlebih dahulu agar angka 100% tidak ikut masuk daftar kandidat
      const leftWithoutPct = leftText.replace(/\d+(?:[ \t]+\d+)*(?:[.,]\d+)?[ \t]*%/g, "");
      const nums = (leftWithoutPct.match(/\b(\d{1,6}(?:[.,]\d{3})*)\b/g) || [])
        .map((v) => parseNumber(v))
        .filter((n): n is number => n !== null && n >= 0 && n <= 99999);

      // Cari pasangan (a, b, c) berurutan di mana a > 0 dan a === b + c (Total = Unscanned + Scanned)
      for (let i = 0; i + 2 < nums.length; i++) {
        const a = nums[i], b = nums[i + 1], c = nums[i + 2];
        if (a > 0 && a === b + c) {
          total = a;
          if (scanned_pct === null) {
            scanned_pct = Math.round((c / a) * 1000) / 10;
          }
          break;
        }
      }

      // Jika hanya 2 angka identik terbaca (Total=260 dan Scanned=260, sedangkan 0 terlewat)
      if (total === null) {
        for (let i = 0; i < nums.length; i++) {
          for (let j = i + 1; j < nums.length; j++) {
            if (nums[i] >= 5 && nums[i] === nums[j]) {
              total = nums[i];
              if (scanned_pct === null) scanned_pct = 100;
              break;
            }
          }
          if (total !== null) break;
        }
      }

      // Fallback terakhir: ambil angka pertama yang >= 5
      if (total === null) {
        const big = nums.filter((n) => n >= 5);
        if (big.length > 0) total = big[0];
      }
    }
  }

  return {
    parcel_sweeper_total:       total,
    parcel_sweeper_scanned_pct: scanned_pct,
  };
}

/**
 * Ekstrak angka To Expedite dari teks OCR sparse (PSM 11).
 * Angka di tengah donut (mis. "63") muncul sebagai baris tersendiri.
 * Nilai donut kecil (<= 999); ID trip & angka tabel lebih besar/diabaikan.
 */
export function extractExpediteSparse(text: string): number | null {
  const m = text.match(/To\s+Expedite([\s\S]{0,800})/i);
  if (!m) return null;
  const block = m[1];
  const standalone = [...block.matchAll(/^\s*(\d{1,4}(?:[.,]\d{3})*)\s*$/gm)]
    .map((mm) => parseNumber(mm[1]))
    .filter((n): n is number => n !== null && n >= 1 && n <= 999);
  return standalone.length ? Math.max(...standalone) : null;
}

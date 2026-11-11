import type { ClosingData } from "@/types/closing";
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
  // Ambil kolom Volume (angka pertama di baris tersebut), toleran terhadap typo OCR umum
  const in_hub_transported = extractInHubVolume(text, /\b(?:[TI]ransp[o0]rt(?:ed)?|Iranspored)\b/i);
  const in_hub_received    = extractInHubVolume(text, /\bR[eo][ce][aeiu]{1,3}[tv]?[ea]?d\b/i);
  const in_hub_assigning   = extractInHubVolume(text, /\bA[sS][a-z]{2,5}[gn]g\b/i);
  const in_hub_assigned    = extractInHubVolume(text, /\bA[sm]{1,2}[a-z]{1,4}n[aeo]?d\b/i);

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

// Toleran terhadap variasi OCR: On-hold, On hold, Onhold, On-hoid, On-hokd, On-holkd, On hod, an hod, Onnoid, Onrhod, Qn-hold, Onhole
const ON_HOLD_LABEL_RE =
  /\b(?:[oq0]n[\s\-r]*[hn][o0a][il1tk]{0,2}d|[oq0]nh[o0][il1]e|an[\s\-]+h[o0]l?d)\b/i;

/**
 * In Hub Status: cari baris label, ambil angka pertama (= kolom Volume)
 * Format baris: "Transported   2   9.229   9.227(100%) ---"
 * Atau di teks copy-paste FMS, label bisa berdiri sendiri di satu baris dan angka di baris berikutnya.
 */
function extractInHubVolume(text: string, label: string | RegExp): number | null {
  const lines = text.split(/\r?\n/);
  const re =
    typeof label === "string"
      ? new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      : label;

  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    let after = afterLabelOnLine(lines[i], re);
    // Jangan ikutkan kolom kanan "Fleet status" bila OCR membaca In Hub & Fleet Status sejajar
    const rightCut = after.search(new RegExp(`\\b(?:Fleet\\s+stat|Delivering|Delivered)|${ON_HOLD_LABEL_RE.source}`, "i"));
    if (rightCut !== -1) after = after.slice(0, rightCut);
    // Jika kolom Volume (kolom ke-1) terbaca OCR sebagai "[]" / "()" sebelum angka Total (mis. "ASEgreng [] 323"), nilainya 0
    if (/^\s*(?:\[\s*\]|\(\s*\))(?:\s|$)/.test(after)) return 0;
    const sameLine = allNumbers(after);
    if (sameLine.length > 0) return sameLine[0];
    // Jika di baris yang sama tidak ada angka (misal copy-paste tabel vertikal), cek 1-2 baris berikutnya
    // tapi berhenti sebelum batas section (mis. "1 Fleet Head Counts") agar tidak menarik angka "1".
    const nextNums = allNumbers(collectFollowingLines(lines, i));
    if (nextNums.length > 0) return nextNums[0];
    // Nilai "-" di FMS = 0
    if (dashToZero(after, null) !== null) return 0;
  }
  return null;
}

const SECTION_BOUNDARY_RE = /Fleet\s+(?:Head|Prod)|Updated|Dedicated|Kurir|Mitra|Backlog|To\s+Expedite|Order/i;

function afterLabelOnLine(line: string, re: RegExp): string {
  const m = line.match(re);
  if (!m || m.index === undefined) return line;
  return line.slice(m.index + m[0].length);
}

function collectFollowingLines(lines: string[], startIdx: number, count = 2): string {
  const out: string[] = [];
  for (let i = startIdx + 1; i <= startIdx + count && i < lines.length; i++) {
    const l = lines[i] || "";
    if (SECTION_BOUNDARY_RE.test(l)) break;
    out.push(l);
  }
  return out.join(" ");
}

/**
 * Fleet Status Delivering: ambil kolom VOLUME (angka ke-1)
 * Format: "Delivering   0   4.448   4.448(100,0%)---"
 *          Vol=0, Total=4.448 → ambil Volume (angka pertama)
 */
function extractFleetDelivering(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const re = /\bD[aeo]l{1,2}[il]?v[aeo]r?[a-z]{0,3}ng\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    // Hindari "First Delivering Time", "Stuck at Delivering", "Delivering attempted" (termasuk typo OCR), atau jika diikuti kata (bukan kolom angka)
    if (/first|stuck|attempt|attemp|stte[mn]|penyelesai/i.test(lines[i])) continue;
    const afterLabel = afterLabelOnLine(lines[i], re);
    if (/^\s*[a-z]{4,}/i.test(afterLabel)) continue;
    if (/^\s*(?:\[\s*\]|\(\s*\))(?:\s|$)/.test(afterLabel)) return 0;
    let nums = allNumbers(afterLabel);
    if (!nums.length) {
      nums = allNumbers(collectFollowingLines(lines, i));
    }
    if (nums.length) return nums[0];
    // Nilai "-" di FMS = 0
    if (dashToZero(afterLabel, null) !== null) return 0;
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
  const re = /\b(?:D[aeo]l[il]?v[aeo]r[ea]?d|Delvend|Dedvered)\b/i;
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    // Skip kartu "Total Delivered to Buyer", "Delivered (%)", atau header "Delivered / Handed Over" di Fleet Productivity
    if (/buyer|total\s+delivered|delivered\s*\(|handed|h[ae]nd[ea]d/i.test(lines[i])) continue;
    const afterLabel = afterLabelOnLine(lines[i], re);
    if (/^\s*(?:\/\s*[a-z]+|[a-z]{4,})/i.test(afterLabel)) continue;
    if (/^\s*(?:\[\s*\]|\(\s*\))(?:\s|$)/.test(afterLabel)) return 0;
    let nums = allNumbers(afterLabel);
    if (!nums.length) {
      nums = allNumbers(collectFollowingLines(lines, i));
    }
    if (nums.length) return nums[0];
    if (dashToZero(afterLabel, null) !== null) return 0;
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
  const idx = lines.findIndex((l) => ON_HOLD_LABEL_RE.test(l));
  if (idx === -1) return { oh_volume: null, oh_total: null };

  const afterLabel = afterLabelOnLine(lines[idx], ON_HOLD_LABEL_RE);
  const parseOnHoldCell = (cell: string): number | null => {
    const cellNums = allNumbers(cell);
    if (cellNums.length > 0) return cellNums[0];
    if (/^\s*(?:\[\s*\]|\(\s*\))(?:\s|$)/.test(cell)) return 0;
    return dashToZero(cell, null);
  };
  // Jika kolom dipisahkan >= 2 spasi (mis. "a   52   17.3%)" atau "43   52   9(17,3%)"), pertahankan posisi kolom Volume & Total
  const cells = afterLabel.trim().split(/\s{2,}/).filter(Boolean);
  if (cells.length >= 2) {
    const ohVol = parseOnHoldCell(cells[0]);
    const ohTot = parseOnHoldCell(cells[1]);
    return {
      // On-hold Volume <= On-hold Total; bila Total terbaca 0 sedangkan Volume garbled ("a   0"), Volume pasti 0
      oh_volume: ohTot === 0 && ohVol === null ? 0 : ohVol,
      oh_total:  ohTot,
    };
  }

  let nums = allNumbers(afterLabel);
  if (nums.length < 2) {
    const extra = collectFollowingLines(lines, idx);
    if (extra) nums = allNumbers(`${afterLabel} ${extra}`);
  }
  return {
    oh_volume: dashToZero(afterLabel, nums[0] ?? null),  // Volume (kiri)
    oh_total:  dashToZero(afterLabel, nums[1] ?? null),  // Total (kanan, jangan salin Volume bila Total belum terbaca)
  };
}

/**
 * Fleet Head Counts — ekstrak angka pertama dari pola "X/Y" atau "-/-" (= 0).
 *
 * Mendukung 3 layout:
 * 1. Side-by-side OCR (Fleet Head Counts berdampingan dengan Fleet Productivity di kanan)
 * 2. Column-by-column OCR (Dedicated -> Kurir Plus -> Mitra tersusun vertikal)
 * 3. Copy-paste FMS / baris tabel ("2WH  17/17  9/9  23/23" atau "-/-  -/-  -/-")
 *
 * Jika section Fleet Head Counts terbaca bernilai "-/-" / kosong ("Attendance Rate -%"
 * tanpa rasio angka), seluruh 5 field diisi 0.
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

  // Isolasi section Fleet Head Counts (tangani kasus berdampingan dengan Fleet Productivity)
  let hcSource = "";
  const hcHeading = text.match(/F[il1]e{1,2}t\s+H[aeo]{2,3}d\s+C[o0]unts?/i);
  if (hcHeading && hcHeading.index !== undefined) {
    const afterStart = text.slice(hcHeading.index + hcHeading[0].length);
    const firstNewline = afterStart.indexOf("\n");
    const firstLine = firstNewline === -1 ? afterStart : afterStart.slice(0, firstNewline);
    const stopMatch = afterStart.match(/(?:\b\d\s+)?Fleet\s+Productivity|D[ae][ilf][a-z]{2,7}\s*\/\s*Hand[aeo]d|Keuangan|Ringkasan/i);
    const hasImmediateStop =
      stopMatch &&
      stopMatch.index !== undefined &&
      afterStart.slice(0, stopMatch.index).trim().length < 8;
    const isSideBySide = /Fleet\s+Productivity/i.test(firstLine) || !!hasImmediateStop;

    if (isSideBySide) {
      const lines = afterStart.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 55);
      const leftLines: string[] = [];
      for (const line of lines) {
        if (/^(?:Keuangan|Ringkasan|Backlog|To\s+Expedite)\b/i.test(line.trim())) break;
        let left = line;
        // Jika kolom Fleet Productivity punya header/baris kedua (Delivered/Handed Over, Order), potong sebelum itu
        const prodCut = left.search(/D[ae][ilf][a-z]{2,7}\s*\/\s*Hand[aeo]d\s+Ov[ae]r|\b\d+\s*Order\b|\bOrder\b|\bOr[gd]er\b/i);
        if (prodCut !== -1) left = left.slice(0, prodCut);
        // Jika header "Actual/Schedule" sejajar dengan baris "2WH/4WH/Lainnya" milik Fleet Productivity di kanan, buang bagian kanan
        if (/Act[a-z]{1,4}\s*\/?\s*Sc[a-z]{2,8}/i.test(left)) {
          const rightTableCut = left.search(/[ \t]+(?:(?:2|Z)[80B]?[ \t]*W?[ \t]*H|(?:4|A)[ \t]*W?[ \t]*H|W[ \t]*H|Lainnya)\b/i);
          if (rightTableCut !== -1) left = left.slice(0, rightTableCut);
        }
        // Jika di baris yang sama ada 2WH/4WH/Lainnya milik Fleet Productivity setelah kolom Head Counts, potong di kemunculan ke-2
        const secondRowLabel = left.match(
          /^([\s\S]*?\b(?:(?:2|Z)[80B]?[ \t]*W?[ \t]*H|(?:4|A)[ \t]*W?[ \t]*H|W[ \t]*H|Lainnya)\b[\s\S]*?)[ \t]+(?=(?:(?:2|Z)[80B]?[ \t]*W?[ \t]*H|(?:4|A)[ \t]*W?[ \t]*H|W[ \t]*H|Lainnya)\b)/i
        );
        if (secondRowLabel) left = secondRowLabel[1];
        leftLines.push(left);
      }
      hcSource = leftLines.join("\n");
    } else {
      hcSource = stopMatch && stopMatch.index !== undefined
        ? afterStart.slice(0, Math.min(stopMatch.index, 1800))
        : afterStart.slice(0, 1800);
    }
  } else {
    // Fallback jika header "Fleet Head Counts" terpotong OCR, tapi label "Actual/Schedule" atau Dedicated+KurirPlus terbaca
    const actualMatch =
      text.match(/Act[a-z]{1,4}\s*\/?\s*Sc[a-z]{2,8}/i) ??
      (!/\b(?:Fleet\s+Productivity|D[ae][ilf][a-z]{2,7}\s*\/\s*Hand|\d+\s*Order\b)/i.test(text)
        ? text.match(/Dedicated[\s\S]{0,60}?K[au]r[a-z]{0,4}\s+P[a-z]{1,4}\b/i)
        : null);
    if (!actualMatch || actualMatch.index === undefined) return result;
    const rawStart = Math.max(0, actualMatch.index - 250);
    let prefix = text.slice(rawStart, actualMatch.index);
    // Jangan ikutkan teks tabel In Hub Status / Fleet Status di atas Fleet Head Counts
    const prevTableMatches = [...prefix.matchAll(/(?:In\s+Hub|Fleet\s+stat|Transported|Received|Assigning|Assigned|Delivering|Delivered|On[\s\-]*hold|\d+%\))/gi)];
    if (prevTableMatches.length > 0) {
      const last = prevTableMatches[prevTableMatches.length - 1];
      if (last.index !== undefined) {
        prefix = prefix.slice(last.index + last[0].length);
      }
    }
    const suffixRaw = text.slice(actualMatch.index, actualMatch.index + 700);
    const stopMatch = suffixRaw.match(/(?:\b\d\s+)?Fleet\s+Productivity|D[ae][ilf][a-z]{2,7}\s*\/\s*Hand|Keuangan/i);
    const suffix = stopMatch && stopMatch.index !== undefined
      ? suffixRaw.slice(0, stopMatch.index)
      : suffixRaw;
    hcSource = prefix + suffix;
  }

  const hcNorm = hcSource.replace(/[–—−]/g, "-");
  // Rasio kurir maksimal 3 digit (0-999) atau "-", bukan persentase ("15/50000%)") atau tanggal ("11/11/2026")
  const RATIO_RE = /(?<![\d.])((?:\d{1,3}|-))\s*\/\s*(?:\d{1,3}|-)(?![\d.%\/])/g;

  // Pola toleran OCR untuk Kurir Plus, Mitra ("Mitra"/"Mltra"/"Mira"/"Mita"/"Miva"/"Mia"), dan Actual
  const KP_PAT = "K[auo][rt][a-z0-9]{0,5}\\s+P[a-z0-9]{1,5}";
  const MITRA_PAT = "(?:M[il1]?[tvr]{1,2}a|Mia|M[aei1]ra|Miss)";
  const ACT_PAT = "A[ce]?t[a-z0-9]{1,6}";

  // Ekstrak angka total header Dedicated / Kurir Plus / Mitra (angka besar di bawah label masing-masing)
  let dedicatedTotal: number | null = null;
  let kurirPlusTotal: number | null = null;
  let mitraTotal: number | null = null;
  const hdrLineMatch =
    hcNorm.match(/De[a-z]{3,8}\b(?![^\n]*Actual)[^\n]*\n\s*(\d{1,3}(?:\s+\d{1,3}){0,2})(?!\s*\/)\b/i) ??
    hcNorm.match(/\n[ \t]*(\d{1,3}[ \t]+\d{1,3}[ \t]+\d{1,3})[ \t]*\r?\n\s*[^\n]*(?:Att|Ada|An|Ate|Ame|Lte|Adm)[a-z]{3,10}/i);
  if (hdrLineMatch) {
    const hdrNums = hdrLineMatch[1].trim().split(/\s+/).map((x) => parseInt(x, 10));
    if (hdrNums[0] != null && !isNaN(hdrNums[0])) dedicatedTotal = hdrNums[0];
    if (hdrNums[1] != null && !isNaN(hdrNums[1])) kurirPlusTotal = hdrNums[1];
    if (hdrNums[2] != null && !isNaN(hdrNums[2])) mitraTotal = hdrNums[2];
  }
  if (kurirPlusTotal === null) {
    const kpHdr = hcNorm.match(new RegExp(`${KP_PAT}\\b(?![^\\n]*Actual)[^\\n]*\\n\\s*(\\d{1,3})(?!\\s*\\/)\\b`, "i"));
    if (kpHdr) kurirPlusTotal = parseInt(kpHdr[1], 10);
  }
  if (mitraTotal === null) {
    const mHdr = hcNorm.match(new RegExp(`(?:M[il1]?[tvr]{1,2}a|Mia|M[aei1]ra|W[il]s)\\b(?![^\\n]*Actual)[^\\n]*\\n\\s*(\\d{1,3})(?!\\s*\\/)\\b`, "i"));
    if (mHdr) mitraTotal = parseInt(mHdr[1], 10);
  }

  // Parse satu sel rasio: dukung "X/Y", "-/-", dan kasus OCR kehilangan "/" (mis. "1818" -> 18, "22" -> 2, "272" -> 2)
  const parseHeadCountCell = (cell: string, colMaxHint?: number | null): number | null => {
    const ratioMatch = cell.match(/(?<![\d.])((?:\d{1,3}|-))\s*\/\s*(?:\d{1,3}|-)(?![\d.%\/])/);
    if (ratioMatch) return ratioNum(ratioMatch[1]);
    const token = cell.trim().match(/^(\d{1,6})$/)?.[1];
    if (!token) return null;
    if (token.length >= 4 && token.length % 2 === 0) {
      const half = token.length / 2;
      const left = parseInt(token.slice(0, half), 10);
      const right = parseInt(token.slice(half), 10);
      if (left === right || (left <= right && right <= 250 && parseInt(token, 10) > 250)) {
        return left;
      }
    }
    if (token.length === 3 && token[0] === token[2] && parseInt(token, 10) > (colMaxHint ?? 200)) {
      return parseInt(token[0], 10);
    }
    if (token.length === 2 && token[0] === token[1] && colMaxHint != null && parseInt(token, 10) > colMaxHint) {
      return parseInt(token[0], 10);
    }
    const n = parseInt(token, 10);
    return n <= (colMaxHint ?? 200) ? n : null;
  };

  const parseCols = (segment: string, colHints?: (number | null)[]): (number | null)[] => {
    const normSeg = segment
      .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
      .replace(/^[\s|[\]().,:;]+/, "");
    // Ambil baris pertama yang berisi angka baris ini agar tidak menggabungkan angka lintas baris (mis. PSM 11 sparse)
    const firstLine = normSeg.split(/\n+/).map((l) => l.trim()).find(Boolean) ?? "";
    const clean = firstLine.replace(/\s+/g, " ").trim();
    const ratios = [...clean.matchAll(RATIO_RE)];
    if (ratios.length >= 3) {
      return ratios.slice(0, 3).map((m) => ratioNum(m[1]));
    }
    // Pertahankan posisi kolom jika salah satu sel gagal OCR atau kehilangan "/" (dipisahkan >= 2 spasi)
    const cells = firstLine.split(/\s{2,}/).filter(Boolean);
    if (cells.length >= 3) {
      return cells.slice(0, 3).map((c, idx) => parseHeadCountCell(c, colHints?.[idx]));
    }
    const lineTokens = firstLine.split(/\s+/).filter(Boolean);
    if (lineTokens.length >= 3) {
      const parsedTokens = lineTokens.slice(0, 3).map((c, idx) => parseHeadCountCell(c, colHints?.[idx]));
      if (parsedTokens.some((v) => v !== null)) return parsedTokens;
    }
    if (cells.length === 2) {
      const pair = cells.map((c, idx) => parseHeadCountCell(c, colHints?.[idx]));
      if (pair.every((v) => v !== null)) return pair;
    }
    if (ratios.length > 0) return ratios.map((m) => ratioNum(m[1]));
    if (cells.length === 1) {
      const val = parseHeadCountCell(cells[0], colHints?.[0]);
      return val !== null ? [val] : [];
    }
    return [];
  };

  // 1. Cari baris "2WH" dan "4WH" (pakai [ \t]* agar tidak menyambung huruf lintas baris seperti "Soma\nWH")
  const ROW4_PAT = "(?:(?:^|[^A-Za-z])(?:4|A)(?:[A-Z]?[ \\t]*W[ \\t]*H|[nr][ \\t]*H)|(?:^|[^0-9A-Za-z])[aA][ \\t]*H(?=[ \\t\\r\\n\\d/|]|$))";
  const m2wh = hcNorm.match(
    new RegExp(
      `(?:(?:2|Z)(?:[ \\t]*W[ \\t]*H|[80B][ \\t]*H)|(?:^|[^4Aa0-9A-Za-z])W[ \\t]*H(?=[ \\t\\r\\n\\d/|]|$))([\\s\\S]{0,600}?)(?:${ROW4_PAT}|Lainnya|Lawr[a-z]{1,4}|Dedicated\\s+${ACT_PAT}|${KP_PAT}\\s+${ACT_PAT}|${MITRA_PAT}\\s+${ACT_PAT}|$)`,
      "i"
    )
  );
  if (m2wh) {
    const cols = parseCols(m2wh[1], [dedicatedTotal, kurirPlusTotal, mitraTotal]);
    if (cols[0] !== undefined && cols[0] !== null) result.dedicated_2wh  = cols[0];
    if (cols[1] !== undefined && cols[1] !== null) result.kurir_plus_2wh = cols[1];
    if (cols[2] !== undefined && cols[2] !== null) result.mitra_2wh      = cols[2];
  }

  const m4wh = hcNorm.match(
    new RegExp(
      `${ROW4_PAT}([\\s\\S]{0,600}?)(?:Lainnya|Lar[a-z]{2,5}|Lawr[a-z]{1,4}|Dedicated\\s+${ACT_PAT}|${KP_PAT}|${MITRA_PAT}|$)`,
      "i"
    )
  );
  if (m4wh) {
    const ded4Hint =
      dedicatedTotal !== null && result.dedicated_2wh !== null
        ? Math.max(0, dedicatedTotal - result.dedicated_2wh)
        : dedicatedTotal;
    const kp4Hint =
      kurirPlusTotal !== null && result.kurir_plus_2wh !== null
        ? Math.max(0, kurirPlusTotal - result.kurir_plus_2wh)
        : kurirPlusTotal;
    const m4Hint =
      mitraTotal !== null && result.mitra_2wh !== null
        ? Math.max(0, mitraTotal - result.mitra_2wh)
        : mitraTotal;
    const cols = parseCols(m4wh[1], [ded4Hint, kp4Hint, m4Hint]);
    if (cols[0] !== undefined && cols[0] !== null) result.dedicated_4wh = cols[0];
    if (cols[2] !== undefined && cols[2] !== null) result.mitra_4wh     = cols[2];
  }

  // 2. Fallback layout vertikal per kolom (Dedicated -> Kurir Plus -> Mitra)
  const lastNonEmptyLine = (s: string) =>
    s.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(-1)[0] ?? "";
  const ROW_LABEL_IN_BLOCK = /\bDedicated\b|\b(?:2|Z)?[ \t]*W[ \t]*H\b|\b(?:4|A)[ \t]*W[ \t]*H\b|Attendance/i;

  if (result.kurir_plus_2wh === null) {
    const kpStop = `(?:^|\\n)[ \\t]*${MITRA_PAT}\\b|${MITRA_PAT}\\s+${ACT_PAT}|To\\s+Deliver|Fleet\\s+status|Selesai|Attendance|$`;
    const kpMatch =
      hcNorm.match(
        new RegExp(
          `(?:^|\\n)[^\\n]{0,20}${KP_PAT}\\s+${ACT_PAT}[^\\n]*\\n([\\s\\S]{0,450}?)(?=${kpStop})`,
          "i"
        )
      ) ??
      hcNorm.match(
        new RegExp(
          `(?:^|\\n)[^\\n]{0,15}${KP_PAT}\\b(?![^\\n]*(?:Attendance|${MITRA_PAT}))([\\s\\S]{0,450}?)(?=${kpStop})`,
          "i"
        )
      );
    if (kpMatch && !ROW_LABEL_IN_BLOCK.test(kpMatch[1])) {
      const prevLine = lastNonEmptyLine(hcNorm.slice(0, kpMatch.index ?? 0));
      if (!new RegExp(`Dedicated\\s+${ACT_PAT}`, "i").test(prevLine)) {
        const ratios = [...kpMatch[1].matchAll(RATIO_RE)];
        if (ratios[0]) result.kurir_plus_2wh = ratioNum(ratios[0][1]);
      }
    }
  }
  if (result.mitra_2wh === null || result.mitra_4wh === null) {
    const mMatch =
      hcNorm.match(
        new RegExp(
          `(?:^|\\n)[^\\n]{0,20}${MITRA_PAT}\\s+${ACT_PAT}[^\\n]*\\n([\\s\\S]{0,260}?)(?=To\\s+Deliver|Fleet\\s+status|Fleet\\s+Productivity|Selesai|$)`,
          "i"
        )
      ) ??
      hcNorm.match(
        new RegExp(
          `${KP_PAT}\\b[\\s\\S]{0,120}?${MITRA_PAT}(?=\\s+${ACT_PAT})\\b(?![^\\n]*\\n\\s*\\d+\\s*\\n[^\\n]*Attendance)([\\s\\S]{0,260})`,
          "i"
        )
      );
    if (mMatch && !ROW_LABEL_IN_BLOCK.test(mMatch[1]) && !new RegExp(`\\b${KP_PAT}\\b`, "i").test(mMatch[1])) {
      const prevLine = lastNonEmptyLine(hcNorm.slice(0, mMatch.index ?? 0));
      if (!new RegExp(`(?:Dedicated|${KP_PAT})\\s+${ACT_PAT}`, "i").test(prevLine)) {
        const ratios = [...mMatch[1].matchAll(RATIO_RE)];
        if (result.mitra_2wh === null && ratios[0]) result.mitra_2wh = ratioNum(ratios[0][1]);
        if (result.mitra_4wh === null && ratios[1]) result.mitra_4wh = ratioNum(ratios[1][1]);
      }
    }
  }

  // 3. Jika Fleet Head Counts bernilai "-/-" / belum ada kurir ("Attendance Rate -%" tanpa rasio aktif > 0):
  //    tulis 0 pada semua hasil Fleet Head Counts.
  //    Abaikan angka persen atau tanggal (mis. "15/50000%)" atau "11/11/2026") agar tidak membatalkan deteksi "-/-".
  const hasPositiveRatio = /\b(?:[1-9]\d*\s*\/\s*\d{1,3}|\d{1,3}\s*\/\s*[1-9]\d*)\b(?!\s*[%\/])/.test(hcNorm);
  const hasAnyRatioSlash = /\d[ \t]*\/[ \t]*\d/.test(hcNorm);
  const hasDashRatio = /-\s*\/\s*-/.test(hcNorm);
  const hasDashAttendance =
    /(?:Attendance|A[a-z]{4,9}nce)\s+Ra[a-z]{1,3}\s*[-~]\s*%/i.test(hcNorm) &&
    !/Attendance\s+Rate\s*\d/i.test(hcNorm);
  const hasEmptyHeaderDash =
    (/Updated\s*:\s*-/i.test(hcNorm) || /(?:^|\n)\s*-\s*(?:\n|$)/.test(hcNorm)) &&
    !/\b\d{1,3}\s*%/.test(hcNorm);
  const hasEmptyFhcCards =
    !hasPositiveRatio &&
    !hasAnyRatioSlash &&
    dedicatedTotal === null &&
    kurirPlusTotal === null &&
    mitraTotal === null &&
    !/\b\d{2,3}[.,]\d\s*%/.test(hcNorm) &&
    /(?:Att|Adm|A[nt]t|Ate)[a-z]{3,10}/i.test(hcNorm);
  if (hasEmptyFhcCards) {
    result.dedicated_2wh  = 0;
    result.kurir_plus_2wh = 0;
    result.dedicated_4wh  = 0;
    result.mitra_2wh      = 0;
    result.mitra_4wh      = 0;
  } else if (
    !hasPositiveRatio &&
    !/\bAttendance\s+Rate\s*\d/i.test(hcNorm) &&
    (hasDashRatio || hasDashAttendance || hasEmptyHeaderDash)
  ) {
    result.dedicated_2wh  ??= 0;
    result.kurir_plus_2wh ??= 0;
    result.dedicated_4wh  ??= 0;
    result.mitra_2wh      ??= 0;
    result.mitra_4wh      ??= 0;
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
 * Helper bersama untuk ekstrak angka tengah donut dari teks OCR sparse (PSM 11).
 * Membersihkan tanggal, jam, persentase, dan label hari agar hanya angka donut
 * berdiri sendiri yang tersisa.
 */
function extractDonutSparseValue(
  text: string,
  headingRegex: RegExp,
  stopRegex: RegExp,
  maxVal: number
): number | null {
  if (isParcelSweeperPage(text)) return null;
  const m = text.match(headingRegex);
  if (!m || m.index === undefined) return null;

  const afterHeading = text.slice(m.index + m[0].length, m.index + m[0].length + 1200);
  const stopIdx = afterHeading.search(stopRegex);
  const block = stopIdx !== -1 ? afterHeading.slice(0, stopIdx) : afterHeading;

  const clean = block
    .replace(/Updated\s*:?\s*\d{1,2}\s+[A-Za-z]{3,}\s+\d{1,2}[:.]\d{2}/gi, "")
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Mei|Jun|Jul|Aug|Agu|Sep|Oct|Okt|Nov|Dec|Des)[A-Za-z]*\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
    .replace(/\d+(?:[,.]\d+)?\s*%/g, "")
    .replace(/>?[ \t]*\d+[ \t]*[-–~]?[ \t]*\d*[ \t]*(?:hari|days?)\b/gi, "")
    .replace(/\b[A-Za-z]+\d+[A-Za-z]*\b/g, "")
    .replace(/\b\d+[A-Za-z]+\b/g, "");

  const standalone = [...clean.matchAll(/^\s*(\d{1,3}(?:[.,]\d{3})+|\d{1,5})\s*$/gm)]
    .map((mm) => parseNumber(mm[1]))
    .filter((n): n is number => n !== null && Number.isInteger(n) && n >= 1 && n <= maxVal);
  return standalone.length ? Math.max(...standalone) : null;
}

/**
 * Ekstrak angka Backlog dari teks OCR sparse (PSM 11).
 * Berguna saat PSM 3 melewatkan angka di dalam donut chart (mis. pada kartu Backlog).
 */
export function extractBacklogSparse(text: string): number | null {
  return extractDonutSparseValue(
    text,
    /Backlog/i,
    /(?:[1Il|]\s+)?To\s+Expedite|Operation\s+Progress|Linehaul\s+Trip|Fleet\s+Head|In\s+Hub\s+Status/i,
    99999
  );
}

/**
 * Ekstrak angka To Expedite dari teks OCR sparse (PSM 11).
 * Angka di tengah donut (mis. "63") muncul sebagai baris tersendiri.
 * Nilai donut kecil (<= 999); ID trip & angka tabel lebih besar/diabaikan.
 */
export function extractExpediteSparse(text: string): number | null {
  return extractDonutSparseValue(
    text,
    /To\s+Expedite/i,
    /Linehaul\s+Trip|Operation\s+Progress|Fleet\s+Head|In\s+Hub\s+Status/i,
    999
  );
}

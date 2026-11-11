import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }

  let credentials;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

// Cache in-memory sederhana (TTL 30 detik) untuk mengurangi kuota read Google Sheets API
const sheetCache = new Map<string, { data: string[][]; expiresAt: number }>();
let sheetListCache: { titles: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

export function invalidateSheetCache(sheetName?: string) {
  if (sheetName) {
    sheetCache.delete(sheetName);
  } else {
    sheetCache.clear();
    sheetListCache = null;
  }
}

/**
 * Ambil semua data dari sebuah sheet (termasuk header row).
 * Menggunakan UNFORMATTED_VALUE + FORMATTED_STRING agar angka tidak rusak oleh locale
 * namun cell bertipe Date tetap dirender sebagai string.
 */
export async function getSheetData(
  sheetName: string,
  options?: { skipCache?: boolean }
): Promise<string[][]> {
  if (!options?.skipCache) {
    const cached = sheetCache.get(sheetName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rawRows = (response.data.values as unknown[][]) || [];
  const normalized: string[][] = rawRows.map((row) =>
    (row || []).map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
  );

  sheetCache.set(sheetName, {
    data: normalized,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return normalized;
}

/**
 * Append satu row ke sheet (lewat appendRows agar selalu ditulis tepat setelah baris terakhir terisi).
 */
export async function appendRow(
  sheetName: string,
  values: (string | number | null)[]
): Promise<number> {
  return appendRows(sheetName, [values]);
}

/**
 * Update row tertentu di sheet (1-indexed, row 1 adalah header)
 */
export async function updateRow(
  sheetName: string,
  rowIndex: number, // 1-indexed
  values: (string | number | null)[]
): Promise<void> {
  const sheets = getSheetsClient();
  const range = `${sheetName}!A${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
  invalidateSheetCache(sheetName);
}

/**
 * Cari row berdasarkan nilai di kolom tertentu (0-indexed column)
 * Return: index row (1-indexed, dimana row 1 = header), atau -1 jika tidak ditemukan
 */
export async function findRow(
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<number> {
  const data = await getSheetData(sheetName, { skipCache: true });
  for (let i = 1; i < data.length; i++) {
    // skip header (index 0)
    if (
      data[i] &&
      data[i][columnIndex] &&
      data[i][columnIndex].toLowerCase().trim() === value.toLowerCase().trim()
    ) {
      return i + 1; // +1 karena Sheets API row adalah 1-indexed
    }
  }
  return -1;
}

/**
 * Cari rows berdasarkan dua kondisi (untuk cari tanggal + hub)
 * Return array of row index (1-indexed)
 */
export async function findRows(
  sheetName: string,
  conditions: { columnIndex: number; value: string }[]
): Promise<number[]> {
  const data = await getSheetData(sheetName, { skipCache: true });
  const results: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    const allMatch = conditions.every(
      ({ columnIndex, value }) =>
        row[columnIndex] &&
        row[columnIndex].toLowerCase().trim() === value.toLowerCase().trim()
    );

    if (allMatch) {
      results.push(i + 1); // 1-indexed
    }
  }

  return results;
}

/**
 * Cek apakah sheet dengan nama tertentu sudah ada
 */
export async function sheetExists(sheetName: string): Promise<boolean> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return (meta.data.sheets || []).some(
    (s) => s.properties?.title === sheetName
  );
}

/**
 * Buat sheet baru dengan header tertentu.
 * Jika sheet sudah ada, tidak melakukan apa-apa.
 */
export async function ensureSheet(
  sheetName: string,
  header: string[]
): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === sheetName
  );

  if (!exists) {
    // Buat sheet baru
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    // Tulis header
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
    sheetListCache = null;
  }
}

/**
 * Daftar semua sheet yang ada di spreadsheet
 */
export async function listSheets(): Promise<string[]> {
  if (sheetListCache && sheetListCache.expiresAt > Date.now()) {
    return sheetListCache.titles;
  }
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const titles = (meta.data.sheets || []).map((s) => s.properties?.title || "");
  sheetListCache = { titles, expiresAt: Date.now() + CACHE_TTL_MS };
  return titles;
}

/**
 * Ambil data dari banyak sheet sekaligus dalam 1 API call (values.batchGet).
 * Sheet yang belum ada di spreadsheet akan mengembalikan array kosong [].
 */
export async function batchGetSheetData(
  sheetNames: string[]
): Promise<Map<string, string[][]>> {
  const result = new Map<string, string[][]>();
  if (sheetNames.length === 0) return result;

  const now = Date.now();
  const uncached: string[] = [];

  for (const name of sheetNames) {
    const cached = sheetCache.get(name);
    if (cached && cached.expiresAt > now) {
      result.set(name, cached.data);
    } else {
      uncached.push(name);
    }
  }

  if (uncached.length === 0) return result;

  const existingTitles = new Set(await listSheets());
  const toFetch: string[] = [];

  for (const name of uncached) {
    if (existingTitles.has(name)) {
      toFetch.push(name);
    } else {
      sheetCache.set(name, { data: [], expiresAt: now + CACHE_TTL_MS });
      result.set(name, []);
    }
  }

  if (toFetch.length === 0) return result;

  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: toFetch,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const valueRanges = response.data.valueRanges || [];
  for (let i = 0; i < toFetch.length; i++) {
    const name = toFetch[i];
    const rawRows = (valueRanges[i]?.values as unknown[][]) || [];
    const normalized: string[][] = rawRows.map((row) =>
      (row || []).map((cell) =>
        cell === null || cell === undefined ? "" : String(cell)
      )
    );
    sheetCache.set(name, { data: normalized, expiresAt: now + CACHE_TTL_MS });
    result.set(name, normalized);
  }

  return result;
}

/**
 * Hitung nomor baris terakhir yang benar-benar berisi data (1-indexed), aman meski ada baris kosong di tengah atau kolom A kosong.
 */
export function findLastNonEmptyRow(rows: string[][]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row && row.some((cell) => String(cell ?? "").trim() !== "")) {
      return i + 1;
    }
  }
  return 0;
}

/** Pastikan jumlah baris grid sheet mencukupi sebelum menulis hingga baris target (1-indexed). */
async function ensureRowCapacity(sheetName: string, requiredLastRow: number): Promise<void> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title,gridProperties.rowCount)",
  });
  const sheetMeta = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  const sheetId = sheetMeta?.properties?.sheetId;
  const currentRowCount = sheetMeta?.properties?.gridProperties?.rowCount ?? 1000;
  if (sheetId != null && requiredLastRow > currentRowCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: "ROWS",
              length: requiredLastRow - currentRowCount + 200,
            },
          },
        ],
      },
    });
  }
}

/**
 * Tulis ulang seluruh isi sheet (header + data) memakai valueInputOption: "RAW"
 * agar tidak mengubah format tanggal yang sudah tersimpan dan membuang celah kosong lama.
 */
export async function rewriteSheetRows(
  sheetName: string,
  allRows: (string | number | null)[][]
): Promise<void> {
  if (allRows.length === 0) return;
  const sheets = getSheetsClient();
  await ensureRowCapacity(sheetName, allRows.length);
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: sheetName });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: allRows },
  });
  invalidateSheetCache(sheetName);
}

/**
 * Urutkan baris data sheet secara stabil (lama -> baru) berdasarkan key hasil getSortKey.
 * Hanya menulis ke Google Sheets jika urutan berubah atau ada baris kosong di tengah.
 */
export async function sortSheetByDateKey(
  sheetName: string,
  columnIndex: number,
  getSortKey: (rawCell: string) => string
): Promise<boolean> {
  const all = await getSheetData(sheetName, { skipCache: true });
  if (all.length <= 2) return false;
  const header = all[0];
  const nonBlank = all.slice(1).filter((r) => r && r.some((c) => String(c ?? "").trim() !== ""));
  const keyed = nonBlank.map((row, idx) => ({
    row,
    idx,
    key: getSortKey(String(row[columnIndex] ?? "")) || "9999-99-99",
  }));
  keyed.sort((a, b) => (a.key !== b.key ? a.key.localeCompare(b.key) : a.idx - b.idx));
  const changed =
    nonBlank.length !== all.length - 1 ||
    keyed.some((entry, pos) => entry.idx !== pos);
  if (!changed) return false;
  await rewriteSheetRows(sheetName, [header, ...keyed.map((e) => e.row)]);
  return true;
}

/**
 * Batch append banyak rows langsung ke baris tepat di bawah data paling akhir (`A${startRow}`) memakai `values.update`.
 * Menghindari Google Sheets `values.append` (mode default OVERWRITE pada deteksi tabel A1) menimpa data tanggal sebelumnya
 * ketika kolom A kosong atau terdapat celah baris kosong di tengah sheet.
 * Return: nomor baris awal (1-indexed) tempat batch baru ditulis.
 */
export async function appendRows(
  sheetName: string,
  values: (string | number | null)[][]
): Promise<number> {
  if (values.length === 0) return 0;
  const sheets = getSheetsClient();

  const existing = await getSheetData(sheetName, { skipCache: true });
  const lastNonEmptyRow = findLastNonEmptyRow(existing);
  const startRow = Math.max(1, lastNonEmptyRow + 1);
  await ensureRowCapacity(sheetName, startRow + values.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${startRow}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  invalidateSheetCache(sheetName);
  return startRow;
}

/**
 * Batch update banyak rows sekaligus — satu batchUpdate call.
 * rowUpdates: array of { rowIndex (1-indexed), values }
 */
export async function updateRows(
  sheetName: string,
  rowUpdates: { rowIndex: number; values: (string | number | null)[] }[]
): Promise<void> {
  if (rowUpdates.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: rowUpdates.map(({ rowIndex, values }) => ({
        range: `${sheetName}!A${rowIndex}`,
        values: [values],
      })),
    },
  });
  invalidateSheetCache(sheetName);
}

/**
 * Hapus semua rows yang memenuhi kondisi (berdasarkan nilai kolom).
 * Karena Google Sheets tidak support delete by value, kita:
 * 1. Ambil semua data
 * 2. Filter out rows yang match
 * 3. Clear sheet
 * 4. Tulis ulang data yang tersisa (header + non-matching rows)
 *
 * Returns: jumlah rows yang dihapus
 */
export async function deleteRowsByColumnValue(
  sheetName: string,
  columnIndex: number,
  matcher: string | ((cellValue: string) => boolean)
): Promise<number> {
  const sheets = getSheetsClient();
  const spreadsheetId = SPREADSHEET_ID;

  // Baca data terbaru langsung dari Sheets agar tidak memproses cache lama
  const all = await getSheetData(sheetName, { skipCache: true });
  if (all.length <= 1) return 0; // hanya header atau kosong

  const header = all[0];
  const dataRows = all.slice(1);
  const isMatch =
    typeof matcher === "function"
      ? (cell: string) => matcher(cell)
      : (cell: string) => cell.toLowerCase().trim() === matcher.toLowerCase().trim();

  // Pisahkan: yang match (akan dihapus) vs yang tidak
  const toKeep = dataRows.filter((row) => !row[columnIndex] || !isMatch(String(row[columnIndex])));
  const deletedCount = dataRows.length - toKeep.length;

  if (deletedCount === 0) return 0;

  // Clear sheet lalu tulis ulang memakai RAW agar tanggal "MM/DD/YYYY" lain tidak dikonversi ulang oleh locale Sheets
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: sheetName });

  const newData = [header, ...toKeep];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: newData },
  });
  invalidateSheetCache(sheetName);

  return deletedCount;
}

/**
 * Warnai satu baris (row) dengan background color kuning.
 * rowIndex: 1-indexed (row 1 = header)
 * Dipakai untuk memberi tanda visual pada batch upload terbaru.
 */
export async function colorRowYellow(
  sheetName: string,
  rowIndex: number    // 1-indexed
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = SPREADSHEET_ID;

  // Ambil sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) return;
  const sheetId = sheet.properties.sheetId;

  // Kuning: RGB(255, 255, 153)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex - 1, // 0-indexed
              endRowIndex:   rowIndex,
              startColumnIndex: 0,
              endColumnIndex: 30,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red:   1.0,
                  green: 1.0,
                  blue:  0.6,  // kuning
                },
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });
}

/**
 * Hapus warna background dari semua rows di sebuah sheet
 * (reset ke putih). Dipakai sebelum set warna baru agar tidak
 * ada row kuning lama yang tertinggal.
 */
export async function clearRowColors(sheetName: string): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = SPREADSHEET_ID;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) return;
  const sheetId = sheet.properties.sheetId;

  const rowCount = sheet.properties.gridProperties?.rowCount ?? 1000;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1, // skip header
              endRowIndex:   rowCount,
              startColumnIndex: 0,
              endColumnIndex: 30,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 }, // putih
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });
}

/**
 * Hapus kolom A secara atomik via `deleteDimension` apabila header kolom A dan B cocok dengan schema lama
 * (mis. A1="district", B1="courier_id"). Menggeser kolom B..end menjadi A..end tanpa merusak nilai/format tanggal.
 */
export async function dropFirstColumnIfHeaderMatches(
  sheetName: string,
  expectedHeaderA: string,
  expectedHeaderB: string
): Promise<boolean> {
  const rows = await getSheetData(sheetName, { skipCache: true });
  const h0 = String(rows[0]?.[0] ?? "").trim().toLowerCase();
  const h1 = String(rows[0]?.[1] ?? "").trim().toLowerCase();
  const colAIsEmptyHeader = h0 === "" && rows.slice(1).every((r) => !String(r[0] ?? "").trim());
  if ((h0 !== expectedHeaderA.toLowerCase() && !colAIsEmptyHeader) || h1 !== expectedHeaderB.toLowerCase()) {
    return false;
  }

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (sheet?.properties?.sheetId == null) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: 1,
            },
          },
        },
      ],
    },
  });
  invalidateSheetCache(sheetName);
  return true;
}

/**
 * Hapus tepat satu baris (1-indexed, wajib > 1 agar header tidak pernah terhapus) secara atomik via deleteDimension.
 */
export async function deleteSheetRow(
  sheetName: string,
  rowIndex: number
): Promise<void> {
  if (!Number.isInteger(rowIndex) || rowIndex <= 1) {
    throw new Error("Row index tidak valid atau mencoba menghapus header");
  }

  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (sheet?.properties?.sheetId == null) {
    throw new Error(`Sheet "${sheetName}" tidak ditemukan`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
  invalidateSheetCache(sheetName);
}

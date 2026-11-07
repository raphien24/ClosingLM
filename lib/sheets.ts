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
 * Append satu row ke sheet
 */
export async function appendRow(
  sheetName: string,
  values: (string | number | null)[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [values],
    },
  });
  invalidateSheetCache(sheetName);
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
 * Batch append banyak rows sekaligus — hanya 1 API call.
 * Jauh lebih efisien dari appendRow satu per satu.
 */
export async function appendRows(
  sheetName: string,
  values: (string | number | null)[][]
): Promise<void> {
  if (values.length === 0) return;
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  invalidateSheetCache(sheetName);
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

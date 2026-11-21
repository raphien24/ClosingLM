import { appendRow, ensureSheet, getSheetData, invalidateSheetCache, updateRow } from "./sheets";
import { nowWIBTimestamp } from "./dateUtils";

const SETTINGS_SHEET = "APP_SETTINGS";
const SETTINGS_HEADERS = ["key", "value", "updated_at", "updated_by"];

const COL_KEY = 0;
const COL_VALUE = 1;
const COL_UPDATED_AT = 2;
const COL_UPDATED_BY = 3;

export const SEATALK_WEBHOOK_KEY = "seatalk_webhook_url";
export const SEATALK_STD_WEBHOOK_KEY = "seatalk_std_webhook_url";

export interface SettingRecord {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string;
}

export class SettingsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

let settingsSheetEnsured = false;

async function ensureSettingsSheetReady(): Promise<void> {
  if (settingsSheetEnsured) return;
  await ensureSheet(SETTINGS_SHEET, SETTINGS_HEADERS, { hidden: true });
  settingsSheetEnsured = true;
}

export async function getSetting(
  key: string,
  options?: { skipCache?: boolean }
): Promise<SettingRecord | null> {
  await ensureSettingsSheetReady();
  const data = await getSheetData(SETTINGS_SHEET, { skipCache: options?.skipCache });
  const target = key.trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const rowKey = String(r?.[COL_KEY] ?? "").trim().toLowerCase();
    if (rowKey === target) {
      return {
        key: String(r[COL_KEY] ?? "").trim(),
        value: String(r[COL_VALUE] ?? "").trim(),
        updated_at: String(r[COL_UPDATED_AT] ?? "").trim(),
        updated_by: String(r[COL_UPDATED_BY] ?? "").trim(),
      };
    }
  }
  return null;
}

export async function setSetting(params: {
  key: string;
  value: string;
  updatedBy: string;
}): Promise<SettingRecord> {
  const cleanKey = params.key.trim();
  const cleanValue = params.value.trim();
  const ts = nowWIBTimestamp();
  const updatedBy = params.updatedBy.trim().toLowerCase();

  await ensureSettingsSheetReady();
  const data = await getSheetData(SETTINGS_SHEET, { skipCache: true });

  let existingRowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    const rowKey = String(data[i]?.[COL_KEY] ?? "").trim().toLowerCase();
    if (rowKey === cleanKey.toLowerCase()) {
      existingRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  const values = [cleanKey, cleanValue, ts, updatedBy];
  if (existingRowIndex > 0) {
    await updateRow(SETTINGS_SHEET, existingRowIndex, values);
  } else {
    await appendRow(SETTINGS_SHEET, values);
  }
  invalidateSheetCache(SETTINGS_SHEET);

  return {
    key: cleanKey,
    value: cleanValue,
    updated_at: ts,
    updated_by: updatedBy,
  };
}

export function validateSeaTalkWebhookUrl(rawUrl: string): string {
  const trimmed = String(rawUrl ?? "").trim();
  if (!trimmed) return "";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SettingsError("Format URL Webhook SeaTalk tidak valid.", 400);
  }

  if (parsed.protocol !== "https:") {
    throw new SettingsError("URL Webhook SeaTalk harus menggunakan protokol https://.", 400);
  }

  if (trimmed.length > 1000) {
    throw new SettingsError("URL Webhook terlalu panjang.", 400);
  }

  return trimmed;
}

export async function getSeaTalkWebhookUrl(options?: {
  skipCache?: boolean;
}): Promise<string> {
  const rec = await getSetting(SEATALK_WEBHOOK_KEY, options);
  return rec?.value || "";
}

export async function getSeaTalkStdWebhookUrl(options?: {
  skipCache?: boolean;
}): Promise<string> {
  const rec = await getSetting(SEATALK_STD_WEBHOOK_KEY, options);
  return rec?.value || "";
}

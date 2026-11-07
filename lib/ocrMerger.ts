import { ClosingData } from "@/types/closing";

interface OcrBatch {
  row: Partial<ClosingData>;
  tanggal_detected: string | null;
}

/**
 * Merge hasil OCR dari beberapa screenshot untuk satu hub.
 * Nilai non-null dari screenshot terakhir menimpa yang sebelumnya.
 */
export function mergeOcrBatches(batches: OcrBatch[]): {
  row: Partial<ClosingData>;
  tanggal_detected: string | null;
  all_dates_detected: string[];
} {
  let merged: Partial<ClosingData> = {};
  let tanggal_detected: string | null = null;
  const datesSet = new Set<string>();

  for (const batch of batches) {
    if (batch.tanggal_detected) {
      datesSet.add(batch.tanggal_detected);
      if (!tanggal_detected) {
        tanggal_detected = batch.tanggal_detected;
      }
    }
    for (const [k, v] of Object.entries(batch.row)) {
      if (v !== null && v !== undefined && v !== "") {
        (merged as Record<string, unknown>)[k] = v;
      }
    }
  }

  return {
    row: merged,
    tanggal_detected,
    all_dates_detected: Array.from(datesSet),
  };
}

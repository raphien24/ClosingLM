"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ScreenshotZone, compressImageFile } from "@/components/input/ScreenshotZone";
import { OcrPreviewTable } from "@/components/input/OcrPreviewTable";
import { ProductivityInputSection } from "@/components/productivity/ProductivityInputSection";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, detectAnomalies } from "@/lib/utils";
import { todayWIB } from "@/lib/dateUtils";
import { parseOcrText, detectParcelSweeperDates, extractBacklogSparse, extractExpediteSparse, isParcelSweeperPage } from "@/lib/ocrParser";
import { mergeOcrBatches } from "@/lib/ocrMerger";
import { runOcrLocally, OcrCancelledError } from "@/lib/ocrClient";
import { ClosingData, AnomalyField } from "@/types/closing";
import {
  ScanText,
  Upload,
  CheckCircle2,
  Plus,
  ClipboardPaste,
  Calendar,
  History,
  Sparkles,
  Edit3,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  Clock,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface OcrRow extends Partial<ClosingData> {
  anomalies: AnomalyField[];
}

type PageState = "idle" | "processing" | "preview" | "saving" | "done";
type ActiveTab = "closing" | "productivity";

const NUM_FIELDS: (keyof ClosingData)[] = [
  "in_hub_transported",
  "in_hub_received",
  "in_hub_assigning",
  "in_hub_assigned",
  "fleet_delivering",
  "fleet_delivered",
  "fleet_oh_volume",
  "fleet_oh_total",
  "dedicated_actual_2wh",
  "kurir_plus_actual_2wh",
  "dedicated_actual_4wh",
  "mitra_actual_2wh",
  "mitra_actual_4wh",
  "backlog_total",
  "total_expedite",
  "parcel_sweeper_total",
  "parcel_sweeper_scanned_pct",
];

const DRAFT_STORAGE_KEY = "closing_spx_draft_v1";

/** Validasi tanggal Parcel Sweeper terhadap tanggal closing yang dipilih user. */
function getParcelSweeperDateError(
  psDates: string[],
  targetDate: string,
  sourceLabel: string
): string | null {
  const mismatchedDate = psDates.find((d) => d !== targetDate);
  if (!mismatchedDate) return null;
  return `${sourceLabel} (${formatDate(mismatchedDate)}) tidak sesuai dengan tanggal closing yang dipilih (${formatDate(targetDate)}). Ubah tanggal closing di date picker jika ingin menginput tanggal lain.`;
}

function UnifiedInputContent() {
  const { hubName } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab: ActiveTab =
    searchParams.get("tab") === "productivity" ? "productivity" : "closing";
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  // Sync jika URL parameter tab berubah dari klik Navbar
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "productivity") setActiveTab("productivity");
    else if (t === "closing") setActiveTab("closing");
  }, [searchParams]);

  const switchTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    const url = tab === "productivity" ? "/input?tab=productivity" : "/input";
    router.replace(url, { scroll: false });
  };

  // Status dari komponen ProductivityInputSection untuk ditampilkan di badge Tab 2
  const [prodStatus, setProdStatus] = useState<{
    isDone: boolean;
    rowCount: number;
  }>({ isDone: false, rowCount: 0 });

  // ── State Input Closing ───────────────────────────────────
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [ocrRow, setOcrRow] = useState<OcrRow | null>(null);
  const [detectedDate, setDetectedDate] = useState<string>(() => todayWIB());
  const [pageState, setPageState] = useState<PageState>("idle");
  const [overwriteModal, setOverwriteModal] = useState(false);
  const [pendingData, setPendingData] = useState<ClosingData | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [showTextBox, setShowTextBox] = useState(false);
  const [previousData, setPreviousData] = useState<ClosingData | null>(null);
  const [recentHistory, setRecentHistory] = useState<ClosingData[]>([]);
const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, number>>({});
  const [ocrEngine, setOcrEngine] = useState<"paddle" | "tesseract" | null>(null);
  const [manualFields, setManualFields] = useState<string[]>([]);
  const [ocrStep, setOcrStep] = useState<string>("Mengoptimalkan gambar...");
  const [ocrElapsed, setOcrElapsed] = useState<number>(0);
  const [processingCount, setProcessingCount] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const ocrBusyRef = useRef(false);
  const runOcrRef = useRef<((targetImages: string[]) => Promise<void>) | null>(null);

  const isProcessing = pageState === "processing";
  const isSaving = pageState === "saving";
  const activeAnomalies = ocrRow ? detectAnomalies(ocrRow) : [];
  const hasAnomalies = activeAnomalies.length > 0;

  const isTodayClosingSaved =
    pageState === "done" ||
    recentHistory.some((item) => item.tanggal === todayWIB());

  // Gabungkan hasil baru ke ocrRow yang sudah ada
  const mergeIntoOcrRow = useCallback(
    (incoming: Partial<ClosingData>, dateDetected?: string | null) => {
      const nextDate = dateDetected || detectedDate;
      if (dateDetected) setDetectedDate(dateDetected);

      const autoKeys: string[] = [];
      setOcrRow((prev) => {
        const merged: Record<string, unknown> = { ...(prev || {}) };
        for (const [k, v] of Object.entries(incoming)) {
          if (v !== null && v !== undefined && v !== "") {
            merged[k] = v;
            autoKeys.push(k);
          }
        }
        merged.nama_hub = hubName || (merged.nama_hub as string) || "";
        merged.tanggal = nextDate;
        merged.anomalies = [];
        return merged as unknown as OcrRow;
      });
      if (autoKeys.length > 0) {
        setManualFields((prev) => prev.filter((f) => !autoKeys.includes(f)));
      }
      setPageState("preview");
    },
    [detectedDate, hubName]
  );

  // Ambil riwayat closing hub & data kemarin
  useEffect(() => {
    if (!hubName) return;
    fetch(`/api/closing?date=${encodeURIComponent(detectedDate)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        setPreviousData(json.previous || null);
        setRecentHistory(json.recentHistory || []);
      })
      .catch(() => {});
  }, [hubName, detectedDate]);

  // Pulihkan draft dari localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        row: OcrRow;
        date: string;
        manualFields?: string[];
        ts: number;
      };
      if (saved?.row && Date.now() - (saved.ts || 0) < 12 * 3600 * 1000) {
        setOcrRow(saved.row);
        if (saved.date) setDetectedDate(saved.date);
        if (Array.isArray(saved.manualFields)) setManualFields(saved.manualFields);
        setPageState("preview");
      }
    } catch {
      // abaikan
    }
  }, []);

  // Simpan draft otomatis ke localStorage
  useEffect(() => {
    try {
      if (ocrRow && pageState === "preview") {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            row: ocrRow,
            date: detectedDate,
            manualFields,
            ts: Date.now(),
          })
        );
      }
    } catch {
      // abaikan
    }
  }, [ocrRow, detectedDate, manualFields, pageState]);

  // Sinkronkan nama_hub & tanggal di ocrRow
  useEffect(() => {
    setOcrRow((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nama_hub: hubName || prev.nama_hub || "",
        tanggal: detectedDate,
      };
    });
  }, [hubName, detectedDate]);

  // Global paste listener HANYA aktif saat berada di Tab "closing"
  useEffect(() => {
    if (activeTab !== "closing") return;

    const handler = (e: ClipboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

      const items = Array.from(e.clipboardData?.items || []).filter((i) =>
        i.type.startsWith("image/")
      );
      if (items.length > 0) {
        if (ocrBusyRef.current || pageState === "processing") {
          toast("Proses OCR masih berjalan, tunggu sebentar...");
          return;
        }
        e.preventDefault();
        const blobs = items
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (blobs.length === 0) return;

        ocrBusyRef.current = true;
        Promise.all(blobs.map(compressImageFile))
          .then((dataUrls) => {
            const batch = [...screenshots, ...dataUrls];
            if (batch.length === 0) {
              ocrBusyRef.current = false;
              return;
            }
            // Hapus gambar dari area upload lalu langsung jalankan OCR
            setScreenshots([]);
            return runOcrRef.current?.(batch);
          })
          .catch(() => {
            ocrBusyRef.current = false;
            toast.error("Gagal memproses gambar dari clipboard.");
          });
        return;
      }

      const plainText = e.clipboardData?.getData("text/plain") || "";
      const htmlText = e.clipboardData?.getData("text/html") || "";
      const strippedHtml = htmlText
        ? htmlText
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&gt;/gi, ">")
            .replace(/&lt;/gi, "<")
        : "";
      const text = plainText + "\n" + strippedHtml;

      if (
        plainText.length > 20 &&
        (isParcelSweeperPage(text) ||
          /transported|received|delivering|delivered|backlog|expedite|2wh|4wh/i.test(text))
      ) {
        e.preventDefault();
        const psDates = detectParcelSweeperDates(text);
        const parsed = parseOcrText(text);

        const psErr = getParcelSweeperDateError(
          psDates,
          detectedDate,
          "Ditolak: Tanggal pada halaman Parcel Sweeper"
        );
        if (psErr) {
          toast.error(psErr, { duration: 6000 });
          return;
        }

        const countFields = Object.values(parsed.row).filter(
          (v) => v != null
        ).length;
        if (countFields > 0) {
          mergeIntoOcrRow(parsed.row);
          if (
            /To\s+Expedite/i.test(plainText) &&
            parsed.row.total_expedite == null
          ) {
            toast.success(
              `${countFields} angka diekstrak (Backlog=${
                parsed.row.backlog_total ?? "-"
              })! Catatan: Angka tengah grafik "To Expedite" berupa gambar kanvas, silakan ketik angkanya atau paste screenshot.`,
              { duration: 6000 }
            );
          } else {
            toast.success(
              `${countFields} angka berhasil diekstrak langsung dari teks FMS (Akurasi 100%)!`
            );
          }
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [activeTab, detectedDate, mergeIntoOcrRow, screenshots, pageState]);

  const handleParseManualText = () => {
    if (!pastedText.trim()) {
      toast.error("Tempel teks dari halaman FMS terlebih dahulu.");
      return;
    }
    const psDates = detectParcelSweeperDates(pastedText);
    const parsed = parseOcrText(pastedText);

    const psErr = getParcelSweeperDateError(
      psDates,
      detectedDate,
      "Ditolak: Tanggal pada halaman Parcel Sweeper"
    );
    if (psErr) {
      toast.error(psErr, { duration: 6000 });
      return;
    }

    const countFields = Object.values(parsed.row).filter(
      (v) => v != null
    ).length;
    if (countFields === 0) {
      toast.error("Tidak ditemukan angka FMS pada teks yang ditempel.");
      return;
    }
    mergeIntoOcrRow(parsed.row);
    setPastedText("");
    setShowTextBox(false);
    toast.success(`${countFields} angka berhasil diekstrak dari teks FMS!`);
  };

  const runOcrForImages = async (targetImages: string[]) => {
    if (!targetImages.length) {
      ocrBusyRef.current = false;
      toast.error("Belum ada screenshot.");
      return;
    }
    ocrBusyRef.current = true;
    setProcessingCount(targetImages.length);
    setPageState("processing");
    cancelledRef.current = false;
    setOcrStep("Membaca screenshot di perangkat...");
    setOcrElapsed(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timer elapsed detik
    const timer = setInterval(() => {
      setOcrElapsed((prev) => prev + 1);
    }, 1000);

    // Langkah status berkala agar pengguna tahu proses sedang berjalan lancar
    const stepTimeout1 = setTimeout(() => {
      setOcrStep("Mengekstrak teks & angka metrik...");
    }, 1500);
    const stepTimeout2 = setTimeout(() => {
      setOcrStep("Mencocokkan data kolom FMS & Parcel Sweeper...");
    }, 4000);

    // Timeout maksimal 90 detik mencegah hanging tak berujung
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 90000);

    try {
      const { texts, sparseTexts, confidences, altTexts, extraTexts } = await runOcrLocally(
        targetImages,
        {
          onProgress: (step) => setOcrStep(step),
          isCancelled: () => cancelledRef.current,
        }
      );

      clearTimeout(timeoutId);
      clearInterval(timer);
      clearTimeout(stepTimeout1);
      clearTimeout(stepTimeout2);

      const batches = [];
      let totalConf = 0;
      const fieldConf: Record<string, number> = {};

      for (let idx = 0; idx < texts.length; idx++) {
        const rawText = texts[idx];
        const altRawText = altTexts[idx] || "";
        const isPs = isParcelSweeperPage(rawText) || isParcelSweeperPage(altRawText);
        const psDates = (() => {
          const d1 = detectParcelSweeperDates(rawText);
          if (d1.length > 0) return d1;
          const d2 = detectParcelSweeperDates(altRawText);
          if (d2.length > 0) return d2;
          return detectParcelSweeperDates(`${rawText}\n${altRawText}\n${sparseTexts[idx] || ""}`);
        })();
        const parsed = parseOcrText(rawText);
        // Keyakinan per field: bandingkan hasil pass 1 (grayscale) dan pass 2 (biner 200).
        const altParsed = parseOcrText(altRawText);
        const baseConf = confidences[idx] ?? 0;
        const rowRec = parsed.row as Record<string, unknown>;
        const altRec = altParsed.row as Record<string, unknown>;
        const agreedMainKeys = new Set<string>();
        for (const k of Object.keys(rowRec)) {
          let v1 = rowRec[k];
          const v2 = altRec[k];
          if (v1 == null && v2 == null) continue;
          // Bacaan 1 gagal tapi bacaan 2 (biner) berhasil -> isi dari bacaan 2.
          let c: number;
          if (v1 == null && v2 != null) {
            rowRec[k] = v2;
            v1 = v2;
            c = Math.min(baseConf || 70, 70);
          } else if (v2 == null) {
            c = Math.min(baseConf || 75, 75);
          } else if (String(v1) === String(v2)) {
            c = Math.max(baseConf, 80);
            agreedMainKeys.add(k);
          } else {
            // Pass 1 dan Pass 2 menghasilkan angka berbeda -> tandai rendah agar dicek ulang.
            c = Math.min(baseConf || 55, 55);
          }
          fieldConf[k] = Math.max(fieldConf[k] ?? 0, c);
        }
        if (!isPs) {
          const fallbackConf = Math.min(baseConf || 75, 75);
          const hasSideBySideLinehaul = /Linehaul|Transporting|\bLT[0O]Q/i.test(`${rawText}\n${altRawText}`);
          const applyFallback = (fk: keyof ClosingData, val: number | null | undefined) => {
            if (val == null || parsed.row[fk] != null) return;
            (parsed.row as Record<string, unknown>)[fk] = val;
            fieldConf[fk] = Math.max(fieldConf[fk] ?? 0, fallbackConf);
          };

          const extraKeys = [
            "in_hub_transported",
            "in_hub_received",
            "in_hub_assigning",
            "in_hub_assigned",
            "fleet_delivering",
            "fleet_delivered",
            "fleet_oh_volume",
            "fleet_oh_total",
            "dedicated_actual_2wh",
            "kurir_plus_actual_2wh",
            "dedicated_actual_4wh",
            "mitra_actual_2wh",
            "mitra_actual_4wh",
            "backlog_total",
            "backlog_to_buyer",
            "backlog_to_seller",
            "backlog_to_transfer",
            "total_expedite",
          ] as const;
          for (const cropText of extraTexts[idx] || []) {
            if (!cropText) continue;
            const cropParsed = parseOcrText(cropText);
            for (const ek of extraKeys) {
              applyFallback(ek, cropParsed.row[ek] as number | null | undefined);
            }
            // Crop donut ter-zoom 2.5x mengisolasi sisi kiri sehingga bebas noise Linehaul Trip dan angka kecil terpotong (mis. "2" dari "20")
            for (const dk of ["backlog_total", "total_expedite"] as const) {
              const curVal = parsed.row[dk];
              const cropVal = cropParsed.row[dk];
              if (cropVal == null) continue;
              const replaceTruncated =
                curVal != null &&
                curVal < 10 &&
                cropVal >= 10 &&
                (!agreedMainKeys.has(dk) || String(cropVal).startsWith(String(curVal)));
              const replaceLinehaulPolluted =
                dk === "total_expedite" && hasSideBySideLinehaul && cropText.startsWith("To Expedite\n");
              if (replaceTruncated || replaceLinehaulPolluted) {
                parsed.row[dk] = cropVal;
                fieldConf[dk] = fallbackConf;
              }
            }
            // Bila fleet_oh_total sebelumnya terbaca < fleet_oh_volume (mustahil, mis. 13 < 103), ganti dari crop yang valid (>= Volume)
            if (
              parsed.row.fleet_oh_volume != null &&
              parsed.row.fleet_oh_total != null &&
              parsed.row.fleet_oh_total < parsed.row.fleet_oh_volume &&
              cropParsed.row.fleet_oh_total != null &&
              cropParsed.row.fleet_oh_total >= parsed.row.fleet_oh_volume
            ) {
              parsed.row.fleet_oh_total = cropParsed.row.fleet_oh_total;
              fieldConf.fleet_oh_total = fallbackConf;
            }
          }
          // Sama seperti crop: bila altPass punya On-hold Total valid (>= Volume) dan pass 1 menghasilkan nilai mustahil (< Volume)
          if (
            parsed.row.fleet_oh_volume != null &&
            parsed.row.fleet_oh_total != null &&
            parsed.row.fleet_oh_total < parsed.row.fleet_oh_volume &&
            altParsed.row.fleet_oh_total != null &&
            altParsed.row.fleet_oh_total >= parsed.row.fleet_oh_volume
          ) {
            parsed.row.fleet_oh_total = altParsed.row.fleet_oh_total;
            fieldConf.fleet_oh_total = fallbackConf;
          }

          const sparseText = sparseTexts[idx] || "";
          if (sparseText) {
            const sparseParsed = parseOcrText(sparseText);
            const fhcKeys = [
              "dedicated_actual_2wh",
              "kurir_plus_actual_2wh",
              "dedicated_actual_4wh",
              "mitra_actual_2wh",
              "mitra_actual_4wh",
            ] as const;
            // Di PSM 11 (sparse), tabel Fleet Head Counts & Fleet Productivity tercampur barisnya;
            // hanya pakai fallback sparse jika seluruhnya terbaca 0 (-/-), agar angka Fleet Productivity (mis. 141/99) tidak bocor.
            if (fhcKeys.every((fk) => sparseParsed.row[fk] === 0)) {
              for (const fk of fhcKeys) applyFallback(fk, 0);
            }
          }
          applyFallback("backlog_total", extractBacklogSparse(sparseText));
          applyFallback("total_expedite", extractExpediteSparse(sparseText));
        }

        if (isPs && psDates.length === 0) {
          throw new Error(
            `Tanggal Parcel Sweeper pada screenshot #${idx + 1} tidak terdeteksi. Pastikan tanggal terlihat jelas di screenshot.`
          );
        }
        const psErr = getParcelSweeperDateError(
          psDates,
          detectedDate,
          `Tanggal Parcel Sweeper pada screenshot #${idx + 1}`
        );
        if (psErr) {
          throw new Error(psErr);
        }

        batches.push(parsed);
        totalConf += confidences[idx] ?? 0;
      }

      const merged = mergeOcrBatches(batches);
      const mergedRec = (merged.row || {}) as Record<string, unknown>;
      const nextFieldConf: Record<string, number> = ocrRow ? { ...fieldConfidence } : {};
      for (const [k, v] of Object.entries(fieldConf)) {
        if (mergedRec[k] != null) nextFieldConf[k] = v;
      }
      const populatedConfs = Object.values(nextFieldConf);
      const avgConf =
        populatedConfs.length > 0
          ? Math.round(populatedConfs.reduce((sum, v) => sum + v, 0) / populatedConfs.length)
          : Math.round(totalConf / texts.length);
      setOcrConfidence(avgConf);
      setFieldConfidence(nextFieldConf);
      setOcrEngine("tesseract");
      mergeIntoOcrRow(merged.row || {});
      setScreenshots([]);
      toast.success("OCR selesai! Periksa dan simpan data.");
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      clearInterval(timer);
      clearTimeout(stepTimeout1);
      clearTimeout(stepTimeout2);

      if (err instanceof OcrCancelledError) {
        toast("Proses OCR dibatalkan");
      } else if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Proses OCR dibatalkan atau waktu habis (timeout 90s).");
      } else {
        toast.error(err instanceof Error ? err.message : "Gagal OCR");
      }
      setPageState(ocrRow ? "preview" : "idle");
    } finally {
      abortControllerRef.current = null;
      ocrBusyRef.current = false;
      setProcessingCount(0);
    }
  };

  useEffect(() => {
    runOcrRef.current = runOcrForImages;
  });

  const handleProcessOcr = () => {
    void runOcrForImages(screenshots);
  };

  const handleCancelOcr = () => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    toast("Proses OCR dibatalkan");
    setPageState(ocrRow ? "preview" : "idle");
  };

  const handleUpdateRow = useCallback(
    (_: number, field: keyof ClosingData, value: string) => {
      if (field === "tanggal") {
        setDetectedDate(value);
      }
      if (NUM_FIELDS.includes(field)) {
        setManualFields((prev) => {
          if (value === "") return prev.filter((f) => f !== field);
          return prev.includes(field) ? prev : [...prev, field];
        });
      }
      setOcrRow((prev) => {
        if (!prev) return prev;
        const updated = { ...prev };
        (updated as Record<string, unknown>)[field] = NUM_FIELDS.includes(field)
          ? value === ""
            ? null
            : parseFloat(value)
          : value;
        return updated;
      });
    },
    []
  );

  const handleClosingDateChange = (val: string) => {
    if (!val) return;
    const today = todayWIB();
    if (val > today) {
      toast.error(
        `Tanggal closing tidak boleh melebihi hari ini (${formatDate(today)}).`
      );
      setDetectedDate(today);
      return;
    }
    setDetectedDate(val);
    setPendingData(null);
  };

  const handleSubmit = async (overwrite = false) => {
    if (!ocrRow) return;
    const baseData =
      overwrite && pendingData ? pendingData : (ocrRow as ClosingData);
    const data: ClosingData = {
      ...baseData,
      nama_hub: hubName || baseData.nama_hub || "",
      tanggal: detectedDate,
      manual_fields: manualFields,
    };
    const notes = detectAnomalies(data);
    if (notes.length > 0) {
      toast.error(
        `Tidak bisa menyimpan: masih ada ${notes.length} catatan yang belum diperbaiki.`
      );
      return;
    }
    setPageState("saving");
    try {
      const res = await fetch("/api/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, overwrite }),
      });
      const json = await res.json();
      if (res.status === 409 && json.duplicate) {
        setPendingData(data);
        setOverwriteModal(true);
        setPageState("preview");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success(json.message || "Data berhasil disimpan!");
      setPageState("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
      setPageState("preview");
    }
  };

  // Shortcut Ctrl+Enter HANYA saat di Tab "closing"
  useEffect(() => {
    if (activeTab !== "closing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        pageState === "preview" &&
        ocrRow &&
        !hasAnomalies
      ) {
        e.preventDefault();
        handleSubmit(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleAddMore = () => {
    setScreenshots([]);
    setPageState("preview");
    toast(
      "Paste screenshot atau teks FMS tambahan — data akan digabungkan otomatis.",
      { icon: "📋" }
    );
  };

  const handleStartEmptyForm = () => {
    setOcrRow({
      nama_hub: hubName || "",
      tanggal: detectedDate,
      anomalies: [],
    });
    setPageState("preview");
  };

  const handleLoadHistoryItem = (item: ClosingData) => {
    setDetectedDate(item.tanggal);
    setOcrRow({ ...item, anomalies: [] });
    setManualFields(item.manual_fields || []);
    setPendingData(null);
    setPageState("preview");
    toast.success(`Data tanggal ${formatDate(item.tanggal)} dimuat untuk diedit.`);
  };

  const handleReset = () => {
    setScreenshots([]);
    setOcrRow(null);
    setOcrConfidence(null);
    setFieldConfidence({});
    setOcrEngine(null);
    setManualFields([]);
    setDetectedDate(todayWIB());
    setPageState("idle");
    setPendingData(null);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
  };

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      {/* Header Utama Pusat Input Data */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === "closing" ? "bg-red-100" : "bg-blue-100"
            }`}
          >
            {activeTab === "closing" ? (
              <Upload className="h-5 w-5 text-red-600" />
            ) : (
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Pusat Input Data Harian
            </h1>
            <p className="text-sm text-gray-500">
              Hub:{" "}
              <span
                className={`font-semibold ${
                  activeTab === "closing" ? "text-red-600" : "text-blue-600"
                }`}
              >
                {hubName}
              </span>
              {" · "}Pilih jenis laporan yang ingin diinput di bawah ini
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2 border border-gray-200 shadow-sm">
          <Calendar
            className={`h-4 w-4 ${
              activeTab === "closing" ? "text-red-500" : "text-blue-500"
            }`}
          />
          <span className="text-xs font-medium text-gray-500">Hari Ini:</span>
          <span className="text-sm font-bold text-gray-900">
            {formatDate(todayWIB())}
          </span>
        </div>
      </div>

      {/* Guided 2-Mode Switcher Cards (Jelas & Tidak Membingungkan) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Mode 1: Input Closing Harian */}
        <button
          type="button"
          onClick={() => switchTab("closing")}
          className={`text-left rounded-2xl p-4 border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
            activeTab === "closing"
              ? "border-red-600 bg-red-50/70 shadow-md ring-2 ring-red-500/20"
              : "border-gray-200 bg-white hover:border-red-200 hover:bg-gray-50/60"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm transition-colors ${
              activeTab === "closing"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <ScanText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-bold ${
                  activeTab === "closing" ? "text-red-900" : "text-gray-800"
                }`}
              >
                1. Input Closing Harian
              </span>
              {isTodayClosingSaved ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✓ Sudah Diinput
                </span>
              ) : ocrRow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Sedang Diedit
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                  Langkah 1
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Copy-Paste teks (<kbd className="px-1 bg-white border rounded">Ctrl+V</kbd>) atau
              Screenshot halaman FMS &amp; Parcel Sweeper
            </p>
          </div>
        </button>

        {/* Card Mode 2: Input Productivity Kurir */}
        <button
          type="button"
          onClick={() => switchTab("productivity")}
          className={`text-left rounded-2xl p-4 border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
            activeTab === "productivity"
              ? "border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20"
              : "border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50/60"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm transition-colors ${
              activeTab === "productivity"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-bold ${
                  activeTab === "productivity"
                    ? "text-blue-900"
                    : "text-gray-800"
                }`}
              >
                2. Input Productivity Kurir
              </span>
              {prodStatus.isDone ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✓ Berhasil Disimpan
                </span>
              ) : prodStatus.rowCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  {prodStatus.rowCount} Kurir Siap Simpan
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                  Langkah 2
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Upload file <strong>Excel (.xlsx)</strong> atau{" "}
              <strong>CSV</strong> hasil export FMS (Harian / Susulan)
            </p>
          </div>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: INPUT CLOSING HARIAN                                  */}
      {/* ============================================================ */}
      <div className={activeTab === "closing" ? "space-y-6" : "hidden"}>
        {/* Tips Akurasi 100% Tanpa OCR */}
        <div className="tips-banner bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="text-xs text-emerald-900 space-y-0.5">
              <p className="font-bold text-sm">
                Mode Input Closing Harian — Cara Cepat &amp; Akurasi 100% (Tanpa
                Tunggu OCR):
              </p>
              <p>
                Di halaman web FMS, tekan{" "}
                <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded font-mono">
                  Ctrl+A
                </kbd>{" "}
                lalu{" "}
                <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded font-mono">
                  Ctrl+C
                </kbd>
                , kemudian pindah ke halaman ini dan tekan{" "}
                <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded font-mono">
                  Ctrl+V
                </kbd>
                . Angka langsung terisi instan!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTextBox((p) => !p)}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              {showTextBox ? "Tutup Kotak Teks" : "Tempel Teks Manual"}
            </Button>
            {pageState === "idle" && (
              <Button variant="ghost" size="sm" onClick={handleStartEmptyForm}>
                <Edit3 className="h-3.5 w-3.5" /> Isi Manual
              </Button>
            )}
          </div>
        </div>

        {/* Kotak tempel teks FMS manual */}
        {showTextBox && (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-4 space-y-3">
            <p className="text-xs font-medium text-gray-700">
              Salin seluruh teks dari halaman FMS (Operation Progress /
              Ringkasan Hub) lalu tempel di bawah ini:
            </p>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={4}
              placeholder="Paste teks dari FMS di sini..."
              className="w-full rounded-xl border border-gray-200 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTextBox(false)}
              >
                Batal
              </Button>
              <Button size="sm" onClick={handleParseManualText}>
                Ekstrak Angka dari Teks
              </Button>
            </div>
          </div>
        )}

        {/* Done */}
        {pageState === "done" ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Data Closing Berhasil Disimpan!
            </h2>
            <p className="text-gray-500 mb-6">
              Data closing <strong>{hubName}</strong> tanggal{" "}
              <strong>{formatDate(detectedDate)}</strong> tersimpan.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={handleReset}>
                <Upload className="h-4 w-4" /> Input Closing Baru
              </Button>
              <Link href="/dashboard">
                <Button variant="outline">Lihat Dashboard Closing</Button>
              </Link>
              <Button
                onClick={() => switchTab("productivity")}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Lanjut ke Input Productivity Kurir
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Pemilih Tanggal Closing */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="closing-date-picker"
                      className="font-bold text-sm text-gray-900"
                    >
                      Tanggal Closing: {formatDate(detectedDate)}
                    </label>
                    {detectedDate !== todayWIB() && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Tanggal Lain / Susulan
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 mt-0.5">
                    Default hari ini. Ubah tanggal jika ingin menginput atau
                    memperbaiki closing tanggal sebelumnya.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {detectedDate !== todayWIB() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleClosingDateChange(todayWIB())}
                  >
                    Hari Ini
                  </Button>
                )}
                <input
                  id="closing-date-picker"
                  type="date"
                  value={detectedDate}
                  max={todayWIB()}
                  onChange={(e) => handleClosingDateChange(e.target.value)}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>

            {/* Step 1 — Screenshot zone */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-semibold text-gray-800">
                  Paste Teks atau Screenshot FMS
                </h2>
                <span className="text-xs text-gray-400 ml-auto">
                  Bisa gabungkan beberapa kali paste (Operation Progress +
                  Ringkasan Hub + Parcel Sweeper)
                </span>
              </div>
              <ScreenshotZone
                screenshots={screenshots}
                onAdd={(b) => setScreenshots((p) => [...p, b])}
                onRemove={(i) =>
                  setScreenshots((p) => p.filter((_, j) => j !== i))
                }
              />
              {screenshots.length > 0 &&
                (pageState === "idle" || pageState === "preview") && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={handleProcessOcr} loading={isProcessing}>
                      <ScanText className="h-4 w-4" />
                      Proses OCR ({screenshots.length} screenshot)
                    </Button>
                  </div>
                )}
            </div>

            {/* Processing */}
            {pageState === "processing" && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center max-w-md mx-auto my-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative inline-flex items-center justify-center mb-3">
                  <div className="w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center animate-spin">
                    <Loader2 className="h-7 w-7 text-red-600" />
                  </div>
                  <ScanText className="h-5 w-5 text-red-500 absolute" />
                </div>
                <h3 className="text-gray-900 font-semibold text-base">Memproses OCR Cepat...</h3>
                <p className="text-xs font-medium text-red-600 mt-1">{ocrStep}</p>
                <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-full py-1.5 px-4 w-fit mx-auto border border-gray-100">
                  <span className="flex items-center gap-1 font-mono text-gray-700">
                    <Clock className="h-3.5 w-3.5 text-gray-400" /> {ocrElapsed}s
                  </span>
                  <span>•</span>
                  <span>{processingCount || screenshots.length} screenshot</span>
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleCancelOcr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5 text-gray-500" />
                    Batalkan Proses
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Preview & simpan */}
            {(pageState === "preview" || pageState === "saving") && ocrRow && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-base font-semibold text-gray-800">
                      Verifikasi &amp; Simpan Closing
                    </h2>
                    {ocrConfidence !== null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ocrConfidence >= 80
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        Keyakinan OCR: {ocrConfidence}%
                      </span>
                    )}
                    {ocrEngine && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ocrEngine === "paddle"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        Mesin: {ocrEngine === "paddle" ? "PaddleOCR" : "Tesseract"}
                      </span>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Tanggal:</span>
                    <input
                      type="date"
                      value={detectedDate}
                      max={todayWIB()}
                      onChange={(e) => handleClosingDateChange(e.target.value)}
                      className="px-2.5 py-1 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </label>
                </div>

                <OcrPreviewTable
                  rows={[ocrRow]}
                  onUpdate={handleUpdateRow}
                  previousData={previousData}
                  fieldConfidence={fieldConfidence}
                  manualFields={manualFields}
                />

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      Ulangi dari Awal
                    </Button>
                    <Button variant="ghost" onClick={handleAddMore}>
                      <Plus className="h-4 w-4" /> Bersihkan Gambar &amp; Tambah
                      Lagi
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      Pintasan:{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded">
                        Ctrl+Enter
                      </kbd>
                    </span>
                    <Button
                      onClick={() => handleSubmit(false)}
                      loading={isSaving}
                      disabled={hasAnomalies || isSaving}
                      title={
                        hasAnomalies
                          ? `Lengkapi ${activeAnomalies.length} catatan terlebih dahulu`
                          : undefined
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Simpan Data Closing
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Riwayat Singkat 7 Hari Terakhir Hub Ini */}
            {recentHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-800">
                      Riwayat Closing Terakhir ({hubName})
                    </h3>
                  </div>
                  <span className="text-xs text-gray-400">
                    Klik salah satu tanggal untuk memuat &amp; mengedit ulang
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentHistory.map((item, idx) => {
                    const isTodayItem = item.tanggal === todayWIB();
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleLoadHistoryItem(item)}
                        title="Klik untuk memuat & mengedit data tanggal ini"
                        className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                          isTodayItem
                            ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-300"
                        }`}
                      >
                        <p className="font-semibold">
                          {formatDate(item.tanggal)}
                        </p>
                        <p className="text-gray-500">
                          Delivered: <strong>{item.fleet_delivered ?? "-"}</strong>{" "}
                          · Backlog: <strong>{item.backlog_total ?? "-"}</strong>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal overwrite Closing */}
        <Modal
          open={overwriteModal}
          onOpenChange={setOverwriteModal}
          title="Data Sudah Ada"
          description={`Data closing ${hubName} untuk tanggal ${formatDate(
            detectedDate
          )} sudah ada. Timpa data lama?`}
        >
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOverwriteModal(false);
                setPendingData(null);
              }}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setOverwriteModal(false);
                handleSubmit(true);
              }}
            >
              Ya, Timpa
            </Button>
          </div>
        </Modal>
      </div>

      {/* ============================================================ */}
      {/* TAB 2: INPUT PRODUCTIVITY KURIR                              */}
      {/* ============================================================ */}
      <div className={activeTab === "productivity" ? "block" : "hidden"}>
        <ProductivityInputSection
          onStatusChange={setProdStatus}
          onSwitchToClosing={() => switchTab("closing")}
        />
      </div>
    </div>
  );
}

export default function InputPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-gray-400">Memuat halaman...</div>
      }
    >
      <UnifiedInputContent />
    </Suspense>
  );
}

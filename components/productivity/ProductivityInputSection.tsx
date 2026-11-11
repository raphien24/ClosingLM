"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { parseFmsRows, FmsRow, ymdToMmDdYyyy } from "@/lib/fmsParser";
import Link from "next/link";

// xlsx di-import dinamis agar tidak masuk ke server bundle
type XlsxModule = typeof import("xlsx");

type PageState = "idle" | "parsing" | "preview" | "saving" | "done";

interface DuplicateCheckResult {
  existingOnDateCount: number;
  willOverwriteCount: number;
  newCount: number;
  overwriteKeys: string[];
  courierProfiles?: Record<
    string,
    { zone_id: string; assigned_target: number | null }
  >;
}

function extractDateFromFilename(name: string): string | null {
  const m1 = name.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = name.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m2) {
    const [, y, m, d] = m2;
    if (
      Number(m) >= 1 &&
      Number(m) <= 12 &&
      Number(d) >= 1 &&
      Number(d) <= 31
    ) {
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

function mmddyyyyToYMD(dateStr: string): string {
  const parts = dateStr.trim().split(/[\/\-]/);
  if (parts.length !== 3) return dateStr.trim();
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parsePercent(v: string | null): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[%,]/g, ""));
  return isNaN(n) ? null : n;
}

interface ProductivityInputSectionProps {
  onStatusChange?: (status: { isDone: boolean; rowCount: number }) => void;
  onSwitchToClosing?: () => void;
}

export function ProductivityInputSection({
  onStatusChange,
  onSwitchToClosing,
}: ProductivityInputSectionProps) {
  const { hubName } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("idle");
  const [rows, setRows] = useState<FmsRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [dateDetected, setDateDetected] = useState<string | null>(null);
  const [formatDetected, setFormatDetected] = useState<
    "daily_fleet" | "historical_performance"
  >("daily_fleet");
  const [skippedOffCount, setSkippedOffCount] = useState<number>(0);
  const [fileName, setFileName] = useState<string>("");
  const [dupCheck, setDupCheck] = useState<DuplicateCheckResult | null>(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [parsingStep, setParsingStep] = useState<string>(
    "Membaca & memproses file Excel/CSV..."
  );
  const [saveSummary, setSaveSummary] = useState<{
    saved: number;
    skipped: number;
    deletedExisting: number;
    wasReplace: boolean;
  } | null>(null);

  const isSaving = pageState === "saving";

  useEffect(() => {
    onStatusChange?.({
      isDone: pageState === "done",
      rowCount: rows.length,
    });
  }, [pageState, rows.length, onStatusChange]);

  const runDuplicateCheck = useCallback(
    async (targetRows: FmsRow[], showToast = true) => {
      if (!targetRows.length) return;
      setCheckingDup(true);
      try {
        const checkRes = await fetch("/api/productivity/input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkOnly: true,
            records: targetRows.map((r) => ({
              courier_id: r.courier_id,
              date: r.date,
            })),
          }),
        });
        const checkJson = await checkRes.json();
        if (checkRes.ok && checkJson.success) {
          const profiles: Record<
            string,
            { zone_id: string; assigned_target: number | null }
          > = checkJson.courierProfiles || {};

          setRows((prev) =>
            prev.map((r) => {
              const prof = profiles[r.courier_id.trim()];
              return {
                ...r,
                zone_id: r.zone_id || prof?.zone_id || "",
              };
            })
          );

          setDupCheck({
            existingOnDateCount: checkJson.existingOnDateCount || 0,
            willOverwriteCount: checkJson.willOverwriteCount || 0,
            newCount: checkJson.newCount || 0,
            overwriteKeys: checkJson.overwriteKeys || [],
            courierProfiles: profiles,
          });

          if (showToast && checkJson.willOverwriteCount > 0) {
            toast(
              `Peringatan: ${checkJson.willOverwriteCount} data kurir di tanggal ini sudah ada dan akan ditimpa jika disimpan.`,
              { icon: "⚠️", duration: 5000 }
            );
          }
        }
      } catch (e) {
        console.error("Failed checking duplicate records:", e);
      } finally {
        setCheckingDup(false);
      }
    },
    []
  );

  // ── Parse file Excel/CSV ─────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      setFileName(file.name);
      setParsingStep("Membaca & memproses file Excel/CSV...");
      setPageState("parsing");

      await new Promise<void>((resolve) => setTimeout(resolve, 350));

      try {
        const XLSX: XlsxModule = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        const filenameDate = extractDateFromFilename(file.name);
        const result = parseFmsRows(rawData, filenameDate);

        if (result.rows.length === 0) {
          toast.error(
            "Tidak ada data kurir aktif ditemukan. Pastikan format file sesuai export FMS."
          );
          setPageState("idle");
          return;
        }

        setRows(result.rows);
        setParseErrors(result.errors);
        setDateDetected(result.dateDetected);
        setFormatDetected(result.formatDetected || "daily_fleet");
        setSkippedOffCount(result.skippedOffCount || 0);
        setDupCheck(null);

        setParsingStep(
          "Mencocokkan riwayat kurir & mengecek data di database..."
        );
        await runDuplicateCheck(result.rows, true);

        setPageState("preview");

        if (result.formatDetected === "historical_performance") {
          toast.success(
            `${result.rows.length} kurir aktif dibaca (${
              result.skippedOffCount || 0
            } kurir off/resign dilewati).`
          );
        } else if (filenameDate && result.dateDetected && filenameDate !== result.dateDetected) {
          toast(
            `Tanggal di dalam kolom First Delivering Time file adalah ${result.dateDetected} (berbeda dari nama file ${filenameDate}). Koreksi di pemilih tanggal bila perlu.`,
            { icon: "📅", duration: 6000 }
          );
        } else if (result.errors.length > 0) {
          toast(
            `${result.rows.length} data dibaca, ${result.errors.length} baris dilewati.`,
            { icon: "⚠️" }
          );
        } else {
          toast.success(`${result.rows.length} data kurir berhasil dibaca!`);
        }
      } catch (err) {
        console.error(err);
        toast.error("Gagal membaca file. Pastikan format Excel/CSV valid.");
        setPageState("idle");
      }
    },
    [runDuplicateCheck]
  );

  // ── Ubah tanggal manual (untuk format susulan) ───────────
  const handleManualDateChange = async (newYmd: string) => {
    setDateDetected(newYmd || null);
    const formattedDate = newYmd ? ymdToMmDdYyyy(newYmd) : "";
    const updatedRows = rows.map((r) => ({ ...r, date: formattedDate }));
    setRows(updatedRows);
    if (newYmd) {
      await runDuplicateCheck(updatedRows, true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── Eksekusi simpan ke API ───────────────────────────────
  const executeSave = async () => {
    if (!rows.length) return;
    setPageState("saving");

    try {
      const records = rows.map((r) => ({
        district: "",
        courier_id: r.courier_id,
        courier_name: r.courier_name,
        date: r.date,
        driver_name: "",
        contract_type: r.contract_type,
        vehicle_type: r.vehicle_type,
        zone_id: r.zone_id,
        assigned: r.assigned,
        assigned_target: r.assigned_target,
        assigned_progress: parsePercent(r.assigned_progress),
        delivery_progress: parsePercent(r.delivery_progress),
        handed_over: r.handed_over,
        delivered: r.delivered,
        delivered_pct: r.delivered_pct,
        delivering_count: r.delivering_count,
        delivering_pct: r.delivering_pct,
        failed_delivery: r.failed_delivery,
        failed_delivery_pct: r.failed_delivery_pct,
        stuck_at_delivering: r.stuck_at_delivering,
        onhold: r.onhold,
      }));

      const res = await fetch("/api/productivity/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setSaveSummary({
        saved:           json.saved           ?? 0,
        skipped:         json.skipped         ?? 0,
        deletedExisting: json.deletedExisting  ?? 0,
        wasReplace:      json.wasReplace       ?? false,
      });
      if (json.wasReplace) {
        toast(json.message, { icon: "⚠️", duration: 6000 });
      } else {
        toast.success(json.message || "Data berhasil disimpan!");
      }
      setPageState("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan.");
      setPageState("preview");
    }
  };

  const handleSaveClick = () => {
    if (!rows.length) return;
    if (!dateDetected || rows.some((r) => !r.date)) {
      toast.error("Pilih tanggal data terlebih dahulu sebelum menyimpan!");
      return;
    }
    // Langsung simpan — duplikat di-skip otomatis di server
    executeSave();
  };

  const handleReset = () => {
    setRows([]);
    setParseErrors([]);
    setDateDetected(null);
    setFormatDetected("daily_fleet");
    setSkippedOffCount(0);
    setFileName("");
    setDupCheck(null);
    setSaveSummary(null);
    setPageState("idle");
  };

  const displayDate = dateDetected
    ? new Date(dateDetected + "T00:00:00").toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Info Sub-header khusus Tab Productivity */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FileSpreadsheet className="h-4 w-4 text-blue-700" />
          </div>
          <div className="text-xs text-blue-900 space-y-0.5">
            <p className="font-bold text-sm">
              Mode Upload Data Produktivitas Kurir (File Excel / CSV FMS)
            </p>
            <p>
              Upload file <strong>.xlsx</strong> atau <strong>.csv</strong> hasil
              export FMS (mendukung <em>Fleet Productivity Harian</em> maupun{" "}
              <em>Driver Performance Susulan</em>).
            </p>
          </div>
        </div>
      </div>

      {/* Done state */}
      {pageState === "done" ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Data Produktivitas Berhasil Disimpan!
          </h2>
          <p className="text-gray-500 text-sm mb-2">
            {rows.length} data kurir untuk tanggal{" "}
            <strong>{displayDate}</strong> telah diproses.
          </p>
          {saveSummary && (
            <div className={`inline-flex flex-col items-center gap-2 border rounded-xl px-5 py-3 text-xs mb-6 ${
              saveSummary.wasReplace
                ? "bg-amber-50 border-amber-300 text-amber-800"
                : "bg-green-50 border-green-200 text-green-800"
            }`}>
              {saveSummary.wasReplace && (
                <p className="font-bold text-sm text-amber-700 flex items-center gap-1.5">
                  ⚠️ Data Lama Diganti
                </p>
              )}
              <div className="flex items-center gap-4">
                <span>
                  Disimpan:{" "}
                  <strong className="text-green-700">{saveSummary.saved} kurir</strong>
                </span>
                {saveSummary.deletedExisting > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span>
                      Dihapus:{" "}
                      <strong className="text-amber-700">{saveSummary.deletedExisting} data lama</strong>
                    </span>
                  </>
                )}
              </div>
              {saveSummary.wasReplace && (
                <p className="text-amber-600 text-[11px]">
                  Baris kuning ditambahkan di Google Sheets sebagai penanda batch ini.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {onSwitchToClosing && (
              <Button variant="outline" onClick={onSwitchToClosing}>
                <ArrowLeft className="h-4 w-4" /> Ke Input Closing Harian
              </Button>
            )}
            <Button variant="outline" onClick={handleReset}>
              <Upload className="h-4 w-4" /> Upload File Lagi
            </Button>
            <Link href="/productivity/weekly">
              <Button>
                <CheckCircle2 className="h-4 w-4" /> Lihat Dashboard Weekly
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Upload zone */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                1
              </span>
              <h2 className="text-base font-semibold text-gray-800">
                Upload File Export FMS (Excel / CSV)
              </h2>
            </div>

            {pageState === "idle" || pageState === "parsing" ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() =>
                  pageState === "idle" && fileInputRef.current?.click()
                }
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  pageState === "parsing"
                    ? "border-blue-400 bg-blue-50/40 cursor-wait"
                    : "border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  {pageState === "parsing" ? (
                    <>
                      <div className="relative flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                        <FileSpreadsheet className="h-6 w-6 text-blue-600 absolute animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-gray-800 font-semibold text-base">
                          Memproses File: {fileName}
                        </p>
                        <p className="text-blue-700 text-xs font-medium animate-pulse">
                          {parsingStep}
                        </p>
                      </div>
                      <div className="w-64 h-1.5 bg-blue-100 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                        <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-700">
                          Drag & drop file Excel/CSV ke sini, atau klik untuk memilih file
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Format: Excel (.xlsx, .xls) atau CSV — hasil export FMS
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <FileSpreadsheet className="h-8 w-8 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {rows.length} kurir
                    {dateDetected && ` · Tanggal: ${displayDate}`}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Preview tabel */}
          {(pageState === "preview" || pageState === "saving") &&
            rows.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      2
                    </span>
                    <h2 className="text-base font-semibold text-gray-800">
                      Verifikasi Data Kurir
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        formatDetected === "historical_performance"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {formatDetected === "historical_performance"
                        ? "Format Susulan (Driver Performance)"
                        : "Format Fleet Harian"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {checkingDup && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Mengecek
                        data existing...
                      </span>
                    )}
                    {parseErrors.length > 0 && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />{" "}
                        {parseErrors.length} baris gagal
                      </span>
                    )}
                  </div>
                </div>

                {/* Pemilih Tanggal — SELALU tampil agar user bisa koreksi */}
                <div
                  className={`mb-4 rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    dateDetected
                      ? formatDetected === "historical_performance"
                        ? "bg-purple-50/70 border-purple-200"
                        : "bg-blue-50/70 border-blue-200"
                      : "bg-red-50 border-red-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <Calendar
                      className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        !dateDetected ? "text-red-600"
                        : formatDetected === "historical_performance" ? "text-purple-600"
                        : "text-blue-600"
                      }`}
                    />
                    <div className="text-xs">
                      <p className={`font-bold text-sm ${!dateDetected ? "text-red-800" : "text-gray-800"}`}>
                        {dateDetected
                          ? `Tanggal Data: ${displayDate}`
                          : "⚠️ Tanggal tidak terdeteksi — pilih manual"}
                      </p>
                      <p className="text-gray-500 mt-0.5">
                        {formatDetected === "historical_performance"
                          ? "Format susulan: tanggal wajib diisi manual."
                          : "Terdeteksi dari kolom \"First Delivering Time\". Koreksi jika salah."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="date"
                      value={dateDetected || ""}
                      onChange={(e) => handleManualDateChange(e.target.value)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border bg-white focus:outline-none focus:ring-2 ${
                        dateDetected
                          ? formatDetected === "historical_performance"
                            ? "border-purple-300 text-gray-800 focus:ring-purple-400"
                            : "border-blue-300 text-gray-800 focus:ring-blue-400"
                          : "border-red-400 text-red-900 focus:ring-red-400"
                      }`}
                    />
                  </div>
                </div>

                {/* Banner Peringatan jika Tanggal / Kurir sudah ada datanya */}
                {dupCheck &&
                  (dupCheck.willOverwriteCount > 0 ||
                    dupCheck.existingOnDateCount > 0) && (
                    <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 space-y-1 flex-1">
                        <p className="font-bold text-sm text-amber-800">
                          ⚠️ Peringatan: Tanggal {displayDate || "ini"} sudah
                          memiliki {dupCheck.existingOnDateCount} data kurir di
                          database!
                        </p>
                        <p>
                          Jika Anda melanjutkan penyimpanan, sistem akan
                          melakukan <strong>timpa otomatis per kurir</strong>:
                        </p>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <span className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md font-semibold">
                            🔄 {dupCheck.willOverwriteCount} Kurir akan ditimpa
                            / diperbarui
                          </span>
                          <span className="inline-flex items-center gap-1.5 bg-green-100 border border-green-300 text-green-900 px-2.5 py-1 rounded-md font-semibold">
                            ➕ {dupCheck.newCount} Kurir baru akan ditambahkan
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Error list */}
                {parseErrors.length > 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      Baris yang dilewati:
                    </p>
                    {parseErrors.slice(0, 5).map((e, i) => (
                      <p key={i} className="text-xs text-amber-600">
                        • {e}
                      </p>
                    ))}
                    {parseErrors.length > 5 && (
                      <p className="text-xs text-amber-500 mt-1">
                        ...dan {parseErrors.length - 5} lainnya
                      </p>
                    )}
                  </div>
                )}

                {/* Preview table */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {[
                            "#",
                            "Status",
                            "ID",
                            "Nama Kurir",
                            "Contract",
                            "Kendaraan",
                            "Zone",
                            "Tanggal",
                            "Assigned",
                            "Target",
                            "Handed Over",
                            "Delivered",
                            "Dlvr%",
                            "Delivering",
                            "Failed",
                            "Onhold",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-2 py-2 text-left font-semibold text-gray-500 uppercase whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((row, i) => {
                          const rowKey = `${row.courier_id.trim()}_${mmddyyyyToYMD(
                            row.date
                          )}`;
                          const isOverwrite =
                            dupCheck?.overwriteKeys.includes(rowKey) ?? false;

                          return (
                            <tr
                              key={i}
                              className={`transition-colors ${
                                isOverwrite
                                  ? "bg-amber-50/60 hover:bg-amber-100/60"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <td className="px-2 py-1.5 text-gray-400">
                                {i + 1}
                              </td>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                {checkingDup ? (
                                  <span className="text-[10px] text-gray-400">
                                    ...
                                  </span>
                                ) : isOverwrite ? (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300"
                                    title="Data kurir di tanggal ini sudah ada dan akan ditimpa"
                                  >
                                    Timpa
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">
                                    Baru
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 font-mono text-gray-600">
                                {row.courier_id}
                              </td>
                              <td className="px-2 py-1.5 font-medium text-gray-800 whitespace-nowrap">
                                {row.courier_name}
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    row.contract_type === "Dedicated"
                                      ? "bg-blue-100 text-blue-700"
                                      : row.contract_type.includes("Kurir Plus")
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-orange-100 text-orange-700"
                                  }`}
                                >
                                  {row.contract_type}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-600">
                                {row.vehicle_type}
                              </td>
                              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                                {row.zone_id || "-"}
                              </td>
                              <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">
                                {row.date || (
                                  <span className="text-red-500 font-semibold">
                                    Pilih Tanggal
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.assigned ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.assigned_target ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.handed_over ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-gray-900">
                                {row.delivered ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-600">
                                {row.delivered_pct !== null
                                  ? `${row.delivered_pct}%`
                                  : "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.delivering_count ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.failed_delivery ?? "-"}
                              </td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {row.onhold ?? "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="outline" onClick={handleReset}>
                    <Upload className="h-4 w-4" /> Ganti File
                  </Button>
                  <Button
                    onClick={handleSaveClick}
                    loading={isSaving || checkingDup}
                    disabled={!dateDetected}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {dupCheck && dupCheck.willOverwriteCount > 0
                      ? `Simpan & Timpa (${rows.length} Kurir)`
                      : `Simpan ${rows.length} Data Kurir`}
                  </Button>
                </div>
              </div>
            )}
        </>
      )}

      {/* Modal Animasi Loading */}
      {(pageState === "parsing" || pageState === "saving") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[1px] px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full p-6 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <FileSpreadsheet className="h-6 w-6 text-blue-600 absolute animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                {pageState === "parsing"
                  ? "Memproses File Upload..."
                  : `Menyimpan ${rows.length} Data Kurir...`}
              </h3>
              <p className="text-xs text-gray-500">
                {pageState === "parsing"
                  ? parsingStep
                  : "Mengirim data ke Google Sheets, mohon tunggu dan jangan tutup halaman ini."}
              </p>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse w-4/5 mx-auto" />
            </div>
          </div>
        </div>
      )}

      {/* Panduan format */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">
          📋 Format file yang didukung (Otomatis Terdeteksi):
        </p>
        <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
          <li>
            <strong>Format 1 (Export Harian Fleet Productivity)</strong>: Kolom{" "}
            <code className="bg-blue-100 px-1 rounded">Driver Name</code> &amp;{" "}
            <code className="bg-blue-100 px-1 rounded">
              First Delivering Time
            </code>{" "}
            (tanggal otomatis terbaca).
          </li>
          <li>
            <strong>
              Format 2 (Export Susulan Hari Sebelumnya / Driver Performance)
            </strong>
            : Kolom <code className="bg-blue-100 px-1 rounded">Driver</code>{" "}
            &amp;{" "}
            <code className="bg-blue-100 px-1 rounded">Attend Days</code>. Kurir
            dengan <strong>Attend Days = 0</strong> (off/resign) otomatis
            dilewati, tipe kontrak &amp; kendaraan dinormalisasi, serta{" "}
            <strong>Zone ID &amp; Target</strong> dilengkapi otomatis dari
            riwayat kurir.
          </li>
          <li>Format Excel (.xlsx, .xls) atau CSV.</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  BellRing,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  FileBarChart2,
  KeyRound,
  Save,
  Send,
  Settings,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

export default function SettingsPage() {
  const { isLoading: authLoading, isOwnerAdmin } = useAuth();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [updatedBy, setUpdatedBy] = useState("");
  const [stdWebhookUrl, setStdWebhookUrl] = useState("");
  const [stdUpdatedAt, setStdUpdatedAt] = useState("");
  const [stdUpdatedBy, setStdUpdatedBy] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingTarget, setTestingTarget] = useState<"closing" | "std" | null>(null);
  const [runningCron, setRunningCron] = useState<string | null>(null);
  const [cronPreview, setCronPreview] = useState<{
    title: string;
    text: string;
    imageDataUrl?: string;
  } | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const gasScheduleSnippet = `// Jalankan fungsi setupSeatalkScheduleTriggers() sekali di Google Apps Script
// agar jadwal berjalan tepat pada 23:19, 23:20, 00:05, & 09:00 WIB (zona Asia/Jakarta).
const CLOSING_LM_URL = "https://closing-lm.vercel.app";
const CLOSING_LM_API_KEY = "spx-soko-jtt08-secure-2026";

function runSeaTalkAutoConfirmSoko2319() {
  const res = UrlFetchApp.fetch(CLOSING_LM_URL + "/api/cron/auto-confirm-soko", {
    method: "POST",
    headers: { "x-api-key": CLOSING_LM_API_KEY },
    muteHttpExceptions: true,
  });
  Logger.log("Auto Confirm Soko 23:19 (" + res.getResponseCode() + "): " + res.getContentText());
}

function runSeaTalkReminder2320() {
  const res = UrlFetchApp.fetch(CLOSING_LM_URL + "/api/cron/reminder-closing", {
    method: "POST",
    headers: { "x-api-key": CLOSING_LM_API_KEY },
    muteHttpExceptions: true,
  });
  Logger.log("Reminder 23:20 (" + res.getResponseCode() + "): " + res.getContentText());
}

function runSeaTalkSummary0005() {
  const res = UrlFetchApp.fetch(CLOSING_LM_URL + "/api/cron/daily-summary", {
    method: "POST",
    headers: { "x-api-key": CLOSING_LM_API_KEY },
    muteHttpExceptions: true,
  });
  Logger.log("Summary 00:05 (" + res.getResponseCode() + "): " + res.getContentText());
}

function runSeaTalkStd0900() {
  const res = UrlFetchApp.fetch(CLOSING_LM_URL + "/api/cron/std-report", {
    method: "POST",
    headers: { "x-api-key": CLOSING_LM_API_KEY },
    muteHttpExceptions: true,
  });
  Logger.log("Monitor STD 09:00 (" + res.getResponseCode() + "): " + res.getContentText());
}

function setupSeatalkScheduleTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    const fn = t.getHandlerFunction();
    if (
      fn === "runSeaTalkAutoConfirmSoko2319" ||
      fn === "runSeaTalkReminder2320" ||
      fn === "runSeaTalkSummary0005" ||
      fn === "runSeaTalkStd0900"
    ) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("runSeaTalkAutoConfirmSoko2319")
    .timeBased().atHour(23).nearMinute(19).everyDays(1).inTimezone("Asia/Jakarta").create();
  ScriptApp.newTrigger("runSeaTalkReminder2320")
    .timeBased().atHour(23).nearMinute(20).everyDays(1).inTimezone("Asia/Jakarta").create();
  ScriptApp.newTrigger("runSeaTalkSummary0005")
    .timeBased().atHour(0).nearMinute(5).everyDays(1).inTimezone("Asia/Jakarta").create();
  ScriptApp.newTrigger("runSeaTalkStd0900")
    .timeBased().atHour(9).nearMinute(0).everyDays(1).inTimezone("Asia/Jakarta").create();
  Logger.log("Trigger SeaTalk 23:19, 23:20, 00:05 & 09:00 WIB berhasil dibuat!");
}`;

  const handleRunCronJob = async (
    endpoint: "reminder-closing" | "daily-summary" | "std-report",
    dryRun: boolean
  ) => {
    const key = `${endpoint}-${dryRun ? "preview" : "send"}`;
    setRunningCron(key);
    try {
      const qs = dryRun ? "?dryRun=1" : "?force=1";
      const res = await fetch(`/api/cron/${endpoint}${qs}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menjalankan jadwal");
      if (json.preview) {
        const previewTitle =
          endpoint === "reminder-closing"
            ? `Preview Reminder 23:20 WIB (${json.targetDate})`
            : endpoint === "daily-summary"
            ? `Preview Daily Summary 00:05 WIB (${json.targetDate})`
            : `Preview Monitor STD 09:00 WIB (${json.reportDate || json.targetDate})`;
        setCronPreview({
          title: previewTitle,
          text: json.preview,
          imageDataUrl: json.previewImageDataUrl,
        });
      }
      toast.success(
        dryRun
          ? "Preview berhasil dimuat."
          : endpoint === "daily-summary" || endpoint === "std-report"
          ? "Gambar report & caption berhasil dikirim ke SeaTalk!"
          : `Pesan berhasil dikirim ke SeaTalk (${json.mentionedCount || 0} PIC tercantum)!`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses request");
    } finally {
      setRunningCron(null);
    }
  };

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      setWebhookUrl(json.settings?.seatalk_webhook_url || "");
      setUpdatedAt(json.settings?.updated_at || "");
      setUpdatedBy(json.settings?.updated_by || "");
      setStdWebhookUrl(json.settings?.seatalk_std_webhook_url || "");
      setStdUpdatedAt(json.settings?.std_updated_at || "");
      setStdUpdatedBy(json.settings?.std_updated_by || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat pengaturan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isOwnerAdmin) {
      loadSettings();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isOwnerAdmin, loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusBanner(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatalk_webhook_url: webhookUrl.trim(),
          seatalk_std_webhook_url: stdWebhookUrl.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan settings");

      setWebhookUrl(json.settings?.seatalk_webhook_url || "");
      setUpdatedAt(json.settings?.updated_at || "");
      setUpdatedBy(json.settings?.updated_by || "");
      setStdWebhookUrl(json.settings?.seatalk_std_webhook_url || "");
      setStdUpdatedAt(json.settings?.std_updated_at || "");
      setStdUpdatedBy(json.settings?.std_updated_by || "");
      setStatusBanner({
        type: "success",
        msg: json.message || "Pengaturan berhasil disimpan.",
      });
      toast.success(json.message || "Pengaturan disimpan!");
    } catch (err) {
      setStatusBanner({
        type: "error",
        msg: err instanceof Error ? err.message : "Gagal menyimpan settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async (target: "closing" | "std") => {
    const candidate = target === "std" ? stdWebhookUrl.trim() : webhookUrl.trim();
    if (!candidate) {
      toast.error(
        target === "std"
          ? "Masukkan URL Webhook SeaTalk Monitor STD terlebih dahulu."
          : "Masukkan URL Webhook SeaTalk Closing terlebih dahulu."
      );
      return;
    }
    setTestingTarget(target);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          seatalk_webhook_url: candidate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test webhook gagal");

      setStatusBanner({
        type: "success",
        msg: json.message || "Pesan test berhasil dikirim ke SeaTalk!",
      });
      toast.success(json.message || "Test pesan terkirim ke SeaTalk!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test webhook gagal";
      setStatusBanner({ type: "error", msg });
      toast.error(msg);
    } finally {
      setTestingTarget(null);
    }
  };

  if (!authLoading && !isOwnerAdmin) {
    return (
      <div className="w-full px-3 sm:px-6 py-8">
        <div className="max-w-xl mx-auto bg-white rounded-xl border border-red-200 p-6 text-center space-y-2 shadow-sm">
          <ShieldAlert className="h-8 w-8 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900">Akses Terbatas</h1>
          <p className="text-sm text-gray-500">
            Halaman Settings hanya dapat diakses oleh akun Owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-3 sm:px-6 py-5 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Settings className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <Badge variant="green">Owner Only</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Konfigurasi integrasi Webhook Group SeaTalk untuk laporan Closing LM &amp; Monitor STD
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">
            Memuat pengaturan...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Field 1: Webhook Closing LM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="seatalk-webhook-url"
                  className="block text-xs font-semibold text-gray-600 uppercase tracking-wider"
                >
                  Webhook SeaTalk Group URL — Report Closing LM
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={testingTarget === "closing"}
                  disabled={isSaving || !!testingTarget || !webhookUrl.trim()}
                  onClick={() => handleTestWebhook("closing")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Test Webhook Closing
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="seatalk-webhook-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://openapi.seatalk.io/webhook/group/xxxxxxxx"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <p className="text-xs text-gray-500">
                Digunakan untuk tombol <strong>Confirm Closing &amp; Send Seatalk</strong>, Reminder Closing <strong>23:20 WIB</strong>, dan Daily Summary <strong>00:05 WIB</strong>.
              </p>
              {updatedAt && (
                <p className="text-[11px] text-gray-400">
                  Terakhir diperbarui: {updatedAt} {updatedBy ? `oleh ${updatedBy}` : ""}
                </p>
              )}
            </div>

            {/* Field 2: Webhook Monitor STD */}
            <div className="pt-5 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="seatalk-std-webhook-url"
                  className="block text-xs font-semibold text-sky-700 uppercase tracking-wider"
                >
                  Webhook SeaTalk Group URL — Report Monitor STD (09:00 WIB)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={testingTarget === "std"}
                  disabled={isSaving || !!testingTarget || !stdWebhookUrl.trim()}
                  onClick={() => handleTestWebhook("std")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Test Webhook STD
                </Button>
              </div>
              <div className="relative">
                <KeyRound className="h-4 w-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="seatalk-std-webhook-url"
                  type="url"
                  value={stdWebhookUrl}
                  onChange={(e) => setStdWebhookUrl(e.target.value)}
                  placeholder="https://openapi.seatalk.io/webhook/group/yyyyyyyy"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
              <p className="text-xs text-gray-500">
                Webhook khusus grup tujuan untuk pengiriman otomatis gambar &amp; summary <strong>Monitor STD</strong> setiap jam <strong>09:00 WIB</strong>.
              </p>
              {stdUpdatedAt && (
                <p className="text-[11px] text-gray-400">
                  Terakhir diperbarui: {stdUpdatedAt} {stdUpdatedBy ? `oleh ${stdUpdatedBy}` : ""}
                </p>
              )}
            </div>

            {statusBanner && (
              <div
                className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                  statusBanner.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {statusBanner.type === "success" ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{statusBanner.msg}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-100">
              <Button type="submit" loading={isSaving} disabled={!!testingTarget}>
                <Save className="h-4 w-4" />
                Simpan Semua Webhook
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Jadwal Otomatis SeaTalk 23:20 WIB, 00:05 WIB & 09:00 WIB */}
      <div className="max-w-4xl bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Jadwal Laporan &amp; Reminder Otomatis SeaTalk
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Otomatis berjalan via GitHub Actions &amp; Google Apps Script pada jam WIB. Anti-duplikat harian aktif.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 23:20 WIB Reminder */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-900">
                <BellRing className="h-4 w-4 text-amber-600" />
                Reminder Closing
              </span>
              <Badge variant="yellow">23:20 WIB</Badge>
            </div>
            <p className="text-xs text-gray-600">
              Men-tag PIC Hub yang belum melakukan submit Closing hari ini agar segera submit sebelum batas 23:59 WIB.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={runningCron === "reminder-closing-preview"}
                disabled={!!runningCron}
                onClick={() => handleRunCronJob("reminder-closing", true)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                loading={runningCron === "reminder-closing-send"}
                disabled={!!runningCron || !webhookUrl.trim()}
                onClick={() => handleRunCronJob("reminder-closing", false)}
              >
                <Send className="h-3.5 w-3.5" />
                Kirim Sekarang
              </Button>
            </div>
          </div>

          {/* Card 00:05 WIB Summary */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-900">
                <FileBarChart2 className="h-4 w-4 text-blue-600" />
                Daily Summary Report
              </span>
              <Badge variant="blue">00:05 WIB</Badge>
            </div>
            <p className="text-xs text-gray-600">
              Mengirim gambar report + caption ringkasan keseluruhan Hub kemarin serta mencantumkan PIC untuk: belum isi report, report/Productivity kosong, gantungan Delivering, &amp; On-Hold.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={runningCron === "daily-summary-preview"}
                disabled={!!runningCron}
                onClick={() => handleRunCronJob("daily-summary", true)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                loading={runningCron === "daily-summary-send"}
                disabled={!!runningCron || !webhookUrl.trim()}
                onClick={() => handleRunCronJob("daily-summary", false)}
              >
                <Send className="h-3.5 w-3.5" />
                Kirim Sekarang
              </Button>
            </div>
          </div>

          {/* Card 09:00 WIB Monitor STD Report */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-900">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                Monitor STD Report
              </span>
              <Badge variant="blue">09:00 WIB</Badge>
            </div>
            <p className="text-xs text-gray-600">
              Mengirim gambar dashboard Monitor STD (KPI + grafik 14 hari + ranking Hub) beserta daftar Hub di bawah target ke Webhook STD.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={runningCron === "std-report-preview"}
                disabled={!!runningCron}
                onClick={() => handleRunCronJob("std-report", true)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                type="button"
                size="sm"
                loading={runningCron === "std-report-send"}
                disabled={!!runningCron || !stdWebhookUrl.trim()}
                onClick={() => handleRunCronJob("std-report", false)}
              >
                <Send className="h-3.5 w-3.5" />
                Kirim Sekarang
              </Button>
            </div>
          </div>
        </div>

        {cronPreview && (
          <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-300">{cronPreview.title}</span>
              <button
                type="button"
                onClick={() => setCronPreview(null)}
                className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>
            {cronPreview.imageDataUrl && (
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-2 overflow-x-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cronPreview.imageDataUrl}
                  alt="Preview Gambar Daily Summary Report"
                  className="w-full max-w-3xl rounded border border-slate-700 mx-auto"
                />
              </div>
            )}
            <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
              {cronPreview.text}
            </pre>
          </div>
        )}

        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">
              Opsional — Script Trigger Google Apps Script (23:19, 23:20, 00:05 &amp; 09:00 WIB)
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(gasScheduleSnippet);
                toast.success("Script Google Apps Script disalin!");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Script GAS
            </Button>
          </div>
          <pre className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] font-mono text-gray-700 overflow-x-auto max-h-56">
            {gasScheduleSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}

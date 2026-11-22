"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Camera,
  CheckCircle2,
  Eye,
  Monitor,
  ScanText,
  XCircle,
} from "lucide-react";

/**
 * Panduan visual & modal contoh framing Screenshot FMS yang benar
 * agar pembacaan OCR di halaman Input Data berjalan akurat.
 */
export function OcrExampleGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger Bar */}
      <div className="mb-4 rounded-xl border border-sky-200 dark:border-sky-500/35 bg-sky-50/80 dark:bg-sky-950/35 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/20 border border-sky-200 dark:border-sky-400/30 flex items-center justify-center flex-shrink-0 text-sky-700 dark:text-sky-300">
            <Camera className="h-4 w-4" />
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
            <span className="font-bold text-sky-900 dark:text-sky-200">
              Panduan Screenshot OCR:
            </span>{" "}
            Sertakan screenshot penuh <strong>Operation Progress</strong>,{" "}
            <strong>Ringkasan Hub (Backlog &amp; To Expedite)</strong>, dan{" "}
            <strong>Parcel Sweeper</strong> (dengan tanggal terlihat jelas).
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-200 border border-sky-300 dark:border-sky-500/40 hover:bg-sky-100/70 dark:hover:bg-slate-700 shadow-2xs transition-colors cursor-pointer flex-shrink-0"
        >
          <Eye className="h-3.5 w-3.5" />
          Lihat Contoh Screenshot OCR
        </button>
      </div>

      {/* Modal Contoh Screenshot */}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Contoh Screenshot FMS yang Benar untuk OCR"
        description="Ikuti framing di bawah ini saat melakukan screenshot (Win+Shift+S / Cmd+Shift+4) lalu Ctrl+V ke area input."
        className="max-w-5xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 dark:border dark:border-slate-700"
      >
        <div className="space-y-5">
          {/* 3 Contoh Mockup Framing FMS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Contoh 1: Operation Progress & Fleet Head Counts */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
                    Operation Progress
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                    FMS Utama
                  </span>
                </div>

                {/* Mockup Wireframe FMS #1 */}
                <div className="rounded-lg border-2 border-dashed border-emerald-500/75 dark:border-emerald-400/60 bg-white dark:bg-slate-950 p-3 space-y-2.5 text-[11px] font-mono shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="font-sans font-bold text-slate-700 dark:text-slate-200">
                      Operation Progress
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                      Frame Utuh ✓
                    </span>
                  </div>

                  {/* In Hub Status */}
                  <div className="rounded bg-slate-50 dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                    <p className="font-sans font-bold text-[10px] text-sky-700 dark:text-sky-300 mb-1">
                      In Hub Status
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Transported</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">140</span>
                      <span className="text-slate-500 dark:text-slate-400">Received</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">2,317</span>
                      <span className="text-slate-500 dark:text-slate-400">Assigning</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">0</span>
                      <span className="text-slate-500 dark:text-slate-400">Assigned</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">0</span>
                    </div>
                  </div>

                  {/* Fleet Status */}
                  <div className="rounded bg-slate-50 dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                    <p className="font-sans font-bold text-[10px] text-amber-700 dark:text-amber-300 mb-1">
                      Fleet Status
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Delivering</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">0</span>
                      <span className="text-slate-500 dark:text-slate-400">Delivered</span>
                      <span className="text-right font-bold text-emerald-600 dark:text-emerald-400">2,543</span>
                      <span className="text-slate-500 dark:text-slate-400">On-hold (Vol/Tot)</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">0 / 0</span>
                    </div>
                  </div>

                  {/* Fleet Head Counts */}
                  <div className="rounded bg-slate-50 dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                    <p className="font-sans font-bold text-[10px] text-indigo-700 dark:text-indigo-300 mb-1">
                      Fleet Head Counts
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Ded 2W / KP 2W</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">12 / 4</span>
                      <span className="text-slate-500 dark:text-slate-400">Ded 4W / Mitra</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">2 / 3</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Pastikan nama label dan angka dari <strong>In Hub Status</strong>, <strong>Fleet Status</strong>, dan <strong>Fleet Head Counts</strong> terlihat utuh tanpa terpotong.
              </p>
            </div>

            {/* Contoh 2: Ringkasan Hub (Backlog & To Expedite) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      2
                    </span>
                    Ringkasan Hub
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                    Backlog &amp; Expedite
                  </span>
                </div>

                {/* Mockup Wireframe FMS #2 */}
                <div className="rounded-lg border-2 border-dashed border-emerald-500/75 dark:border-emerald-400/60 bg-white dark:bg-slate-950 p-3 space-y-2.5 text-[11px] font-mono shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="font-sans font-bold text-slate-700 dark:text-slate-200">
                      Ringkasan Hub
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                      Frame Utuh ✓
                    </span>
                  </div>

                  {/* LM Hub Aging / Backlog */}
                  <div className="rounded bg-rose-50/70 dark:bg-rose-950/35 p-2.5 border border-rose-200 dark:border-rose-500/35 space-y-1.5">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-bold text-[10px] text-rose-800 dark:text-rose-200">
                        LM Hub Aging / Backlog
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-bold">
                        Wajib
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300">Backlog Total</span>
                      <span className="font-extrabold text-rose-700 dark:text-rose-300">110</span>
                    </div>
                  </div>

                  {/* To Expedite */}
                  <div className="rounded bg-amber-50/70 dark:bg-amber-950/35 p-2.5 border border-amber-200 dark:border-amber-500/35 space-y-1.5">
                    <div className="flex items-center justify-between font-sans">
                      <span className="font-bold text-[10px] text-amber-800 dark:text-amber-200">
                        To Expedite
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white text-[9px] font-bold">
                        Wajib
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 dark:text-slate-300">To Expedite</span>
                      <span className="font-extrabold text-amber-700 dark:text-amber-300">12</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Jika bagian <strong>Backlog</strong> dan <strong>To Expedite</strong> berada di bagian bawah halaman FMS, scroll sedikit lalu screenshot penuh dan paste sebagai gambar tambahan.
              </p>
            </div>

            {/* Contoh 3: Parcel Sweeper */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                      3
                    </span>
                    Parcel Sweeper
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">
                    Validasi Tanggal
                  </span>
                </div>

                {/* Mockup Wireframe FMS #3 */}
                <div className="rounded-lg border-2 border-dashed border-emerald-500/75 dark:border-emerald-400/60 bg-white dark:bg-slate-950 p-3 space-y-2.5 text-[11px] font-mono shadow-2xs">
                  <div className="flex items-center justify-between text-[10px] border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="font-sans font-bold text-slate-700 dark:text-slate-200">
                      Parcel Sweeper Task
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                      Frame Utuh ✓
                    </span>
                  </div>

                  {/* Highlight Tanggal Wajib */}
                  <div className="rounded bg-amber-50 dark:bg-amber-950/45 px-2.5 py-2 border-2 border-amber-400 dark:border-amber-500/70 space-y-1">
                    <div className="flex items-center justify-between font-sans text-[10px]">
                      <span className="font-extrabold text-amber-900 dark:text-amber-200">
                        Tanggal / Task ID
                      </span>
                      <span className="px-1.5 py-0 rounded bg-red-600 text-white text-[9px] font-bold">
                        HARUS TERLIHAT
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-700 dark:text-slate-200">
                      Tanggal: 2026-11-22 • PS20261122...
                    </div>
                  </div>

                  {/* Card Parcel Sweeper */}
                  <div className="rounded bg-sky-50/80 dark:bg-sky-950/35 p-2.5 border border-sky-200 dark:border-sky-500/35 space-y-1.5">
                    <p className="font-sans font-bold text-[10px] text-sky-800 dark:text-sky-200">
                      Kartu Parcel Sweeper (Kiri)
                    </p>
                    <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">Total</span>
                      <span className="text-right font-bold text-slate-800 dark:text-slate-100">111</span>
                      <span className="text-slate-500 dark:text-slate-400">Expected Orders Scanned</span>
                      <span className="text-right font-bold text-blue-700 dark:text-sky-300">100%</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong>Tanggal pada halaman Parcel Sweeper wajib terlihat jelas</strong> dan sesuai dengan <em>Tanggal Closing</em> yang dipilih agar tidak ditolak oleh validasi OCR.
              </p>
            </div>
          </div>

          {/* Checklist Benar vs Hindari */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Yang Disarankan (Akurasi Tinggi)
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                <li>Gunakan screenshot langsung dari komputer (<kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-mono">Win+Shift+S</kbd> lalu <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-mono">Ctrl+V</kbd>).</li>
                <li>Atur zoom browser FMS pada <strong>100%</strong> agar angka dan pemisah ribuan tidak pecah.</li>
                <li>Boleh menggabungkan beberapa screenshot sekaligus sebelum menekan <strong>Proses OCR</strong>.</li>
                <li>Bisa juga copy teks langsung dari halaman FMS dan tekan <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-mono">Ctrl+V</kbd>.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50/80 dark:bg-rose-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Yang Sebaiknya Dihindari
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                <li><strong>Jangan memotret layar monitor pakai kamera HP</strong> karena pantulan cahaya &amp; moire membuat angka sering salah baca.</li>
                <li><strong>Jangan crop terlalu sempit</strong> hingga label nama bagian (seperti <em>In Hub Status</em>, <em>Fleet Status</em>, atau tanggal Parcel Sweeper) hilang.</li>
                <li><strong>Jangan mengirim gambar kompresi rendah/buram</strong> dari chat WA yang sudah pecah resolusinya.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              OCR berjalan 100% lokal di browser perangkat Anda.
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-sky-600 text-white font-bold hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors cursor-pointer"
            >
              <ScanText className="h-3.5 w-3.5" />
              Mengerti, Lanjut Upload
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

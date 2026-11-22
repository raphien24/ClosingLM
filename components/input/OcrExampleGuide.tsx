"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  Camera,
  CheckCircle2,
  Eye,
  Maximize2,
  Monitor,
  ScanText,
  XCircle,
} from "lucide-react";

interface OcrExampleItem {
  id: string;
  step: number;
  title: string;
  badge: string;
  badgeClass: string;
  src: string;
  description: string;
}

const OCR_EXAMPLES: OcrExampleItem[] = [
  {
    id: "operation-progress",
    step: 1,
    title: "Ringkasan Hub — In Hub, Fleet & Head Counts",
    badge: "Bagian Atas FMS",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    src: "/images/ocr-examples/fms-operation-progress.jpg",
    description:
      "Pastikan tabel In Hub Status, Fleet Status, dan Fleet Head Counts (2WH/4WH Dedicated, Kurir Plus, Mitra) terlihat utuh dari kiri ke kanan.",
  },
  {
    id: "backlog-expedite",
    step: 2,
    title: "Ringkasan Hub — Backlog & To Expedite",
    badge: "Bagian Bawah FMS",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    src: "/images/ocr-examples/fms-backlog-expedite.jpg",
    description:
      "Scroll ke bagian Backlog (LM Hub Aging) & To Expedite pada tab Ringkasan Hub, pastikan angka total Backlog & Expedite terbaca jelas.",
  },
  {
    id: "parcel-sweeper",
    step: 3,
    title: "Parcel Sweeper View (Tanggal Wajib Terlihat)",
    badge: "Validasi Tanggal",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
    src: "/images/ocr-examples/fms-parcel-sweeper.jpg",
    description:
      "Pastikan Task ID (PS...) & Tanggal serta kartu kiri (% Expected Order Scanned, Total, Unscanned, Scanned) terlihat jelas dan cocok dengan tanggal Closing.",
  },
];

/**
 * Panduan visual & modal contoh Screenshot FMS asli yang dibutuhkan
 * agar pembacaan OCR di halaman Input Data berjalan akurat.
 */
export function OcrExampleGuide() {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState<OcrExampleItem | null>(null);

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
            Sertakan 3 screenshot FMS: <strong>In Hub &amp; Fleet</strong>,{" "}
            <strong>Backlog &amp; To Expedite</strong>, serta{" "}
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

      {/* Modal Contoh Screenshot Asli */}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Contoh Screenshot FMS yang Benar untuk OCR"
        description="Gunakan 3 tampilan halaman FMS di bawah ini saat melakukan screenshot penuh lalu paste (Ctrl+V) ke area upload."
        className="max-w-5xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 dark:border dark:border-slate-700"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {OCR_EXAMPLES.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-start gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white leading-snug">
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {item.step}
                      </span>
                      <span>{item.title}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${item.badgeClass}`}
                    >
                      {item.badge}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoomed(item)}
                    title="Klik untuk memperbesar gambar contoh"
                    className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xs cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt={item.title}
                      className="w-full h-44 object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 text-white px-2 py-1 text-[10px] font-semibold opacity-90 group-hover:opacity-100">
                      <Maximize2 className="h-3 w-3" />
                      Perbesar
                    </span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Checklist Benar vs Hindari */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Yang Disarankan (Akurasi Tinggi)
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                <li>
                  Screenshot penuh tampilan web FMS dari komputer (
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-mono">
                    Win+Shift+S
                  </kbd>{" "}
                  lalu{" "}
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-mono">
                    Ctrl+V
                  </kbd>
                  ).
                </li>
                <li>
                  Atur zoom browser FMS pada <strong>100%</strong> agar angka tidak pecah.
                </li>
                <li>
                  Gabungkan ke-3 screenshot sekaligus sebelum klik{" "}
                  <strong>Proses OCR</strong>.
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50/80 dark:bg-rose-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-extrabold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Yang Sebaiknya Dihindari
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200 list-disc pl-4">
                <li>
                  <strong>Jangan memotret layar monitor pakai kamera HP</strong>{" "}
                  karena silau &amp; moire sering mengganggu OCR.
                </li>
                <li>
                  <strong>Jangan crop terlalu sempit</strong> hingga label judul atau
                  tanggal Parcel Sweeper terpotong.
                </li>
                <li>
                  <strong>Hindari gambar buram hasil kirim ulang WA</strong>{" "}
                  yang terkompresi rendah.
                </li>
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

      {/* Modal Perbesar Gambar */}
      <Modal
        open={!!zoomed}
        onOpenChange={(isOpen) => {
          if (!isOpen) setZoomed(null);
        }}
        title={zoomed ? `Contoh #${zoomed.step}: ${zoomed.title}` : ""}
        description={zoomed?.description}
        className="max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 dark:border dark:border-slate-700"
      >
        {zoomed && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomed.src}
              alt={zoomed.title}
              className="w-full h-auto block"
            />
          </div>
        )}
      </Modal>
    </>
  );
}

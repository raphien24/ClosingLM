"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  LogIn,
  Upload,
  LayoutDashboard,
  ClipboardList,
  Target,
  BarChart2,
  Calendar,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Clock,
  ArrowRight,
  Lightbulb,
  Rocket,
} from "lucide-react";

type Step = {
  phase: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string; // tailwind gradient
  href?: string;
  cta?: string;
  points: string[];
  tip?: string;
};

const STEPS: Step[] = [
  {
    phase: "Persiapan",
    title: "Login dengan Akun Google",
    desc: "Masuk menggunakan email yang sudah terdaftar dan diotorisasi untuk Hub Anda.",
    icon: LogIn,
    color: "from-sky-500 to-blue-600",
    points: [
      "Email harus terdaftar pada daftar user Hub.",
      "Jika muncul halaman Unauthorized, hubungi admin untuk didaftarkan.",
      "Nama Hub otomatis terdeteksi dari akun Anda.",
    ],
  },
  {
    phase: "Setiap Minggu (Senin)",
    title: "Target Produktivitas & Adjust Target",
    desc: "Target otomatis mengambil target di hari Senin. Jika ada perubahan target, lakukan perubahan pada menu Adjust Target.",
    icon: Target,
    color: "from-amber-500 to-orange-600",
    href: "/productivity/targets",
    cta: "Buka Adjust Target",
    points: [
      "Target otomatis mengambil target di hari Senin sebagai acuan satu minggu berjalan.",
      "Jika ada perubahan target, lakukan perubahan target pada menu Adjust Target.",
      "Target mencakup segmen 2W Dedicated, 2W Kurir Plus, dan 4W Dedicated.",
    ],
    tip: "Gunakan menu Adjust Target kapan saja jika terdapat penyesuaian target di tengah minggu.",
  },
  {
    phase: "Setiap Hari",
    title: "Input Data Closing",
    desc: "Upload screenshot closing harian — OCR akan membaca angka secara otomatis.",
    icon: Upload,
    color: "from-violet-500 to-purple-600",
    href: "/input",
    cta: "Buka Input Data",
    points: [
      "Upload / paste screenshot In-Hub, Fleet, Backlog, Expedite & Parcel Sweeper.",
      "Periksa tabel preview hasil OCR, koreksi jika ada angka yang keliru.",
      "Sistem menandai anomali (angka tidak wajar) sebelum disimpan.",
    ],
  },
  {
    phase: "Setiap Hari",
    title: "Input Data Productivity",
    desc: "Upload file Excel Fleet Productivity dari SPX untuk mencatat performa kurir.",
    icon: ClipboardList,
    color: "from-fuchsia-500 to-pink-600",
    href: "/input?tab=productivity",
    cta: "Buka Input Productivity",
    points: [
      "Download file Excel Fleet Productivity dari SPX.",
      "Upload di tab Productivity, data kurir akan tersimpan ke database RAW Hub.",
      "Data yang sudah ada di tanggal yang sama akan diperbarui (tidak dobel).",
    ],
  },
  {
    phase: "Monitoring",
    title: "Pantau Dashboard Closing",
    desc: "Lihat ringkasan closing seluruh Hub, KPI dan insight anomali.",
    icon: LayoutDashboard,
    color: "from-emerald-500 to-teal-600",
    href: "/dashboard",
    cta: "Buka Dashboard Closing",
    points: [
      "Filter berdasarkan tanggal dan Hub.",
      "Perhatikan backlog ≥ 1 hari, onhold, dan expedite.",
      "Gunakan insight card untuk menentukan prioritas tindak lanjut.",
    ],
  },
  {
    phase: "Evaluasi Mingguan",
    title: "Analisa Weekly Productivity",
    desc: "Evaluasi achievement mingguan, Daily Active Rate, dan Action Plan per segmen.",
    icon: BarChart2,
    color: "from-blue-500 to-indigo-600",
    href: "/productivity/weekly",
    cta: "Buka Weekly",
    points: [
      "Lihat KPI 2W & 4W setelah threshold 75%.",
      "Gunakan Action Plan → 'Target Besok' untuk mengejar target mingguan.",
      "Klik nama kurir di tabel untuk melihat detail harian.",
    ],
  },
  {
    phase: "Opsional",
    title: "Aktifkan Grace Period 14 Hari",
    desc: "Kecualikan kurir baru (< 14 hari) dari skor produktivitas Weekly & Monthly.",
    icon: UserCheck,
    color: "from-lime-500 to-green-600",
    points: [
      "Hanya tersedia bila Hub sudah memiliki data L15D (≥ 15 hari).",
      "Kurir baru tetap dihitung di Daily Active Rate.",
      "Kurir baru tetap tampil di tabel dengan badge 'Kurir Baru (H-X)'.",
    ],
  },
  {
    phase: "Evaluasi Bulanan",
    title: "Review Monthly Productivity",
    desc: "Rekap performa bulanan, breakdown harian & mingguan untuk laporan.",
    icon: Calendar,
    color: "from-rose-500 to-red-600",
    href: "/productivity/monthly",
    cta: "Buka Monthly",
    points: [
      "Pilih bulan, contract type, dan vehicle type.",
      "Bandingkan tren produktivitas antar minggu.",
      "Gunakan sebagai bahan evaluasi & laporan ke atasan.",
    ],
  },
];

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function StepCard({ step, index, done, onToggle }: { step: Step; index: number; done: boolean; onToggle: () => void }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const left = index % 2 === 0;
  const Icon = step.icon;

  return (
    <div
      ref={ref}
      className={`relative flex md:items-center ${left ? "md:flex-row" : "md:flex-row-reverse"} transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${(index % 3) * 80}ms` }}
    >
      {/* Node */}
      <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
        <div className={`relative w-11 h-11 rounded-full bg-gradient-to-br ${step.color} text-white flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-bold text-sm">{index + 1}</span>}
          {!done && visible && <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${step.color} animate-ping opacity-20`} />}
        </div>
      </div>

      <div className="hidden md:block md:w-1/2" />

      {/* Card */}
      <div className={`pl-16 md:pl-0 w-full md:w-1/2 ${left ? "md:pr-12" : "md:pl-12"}`}>
        <div
          className={`group relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-800 dark:border-slate-700 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${
            done ? "border-emerald-300" : "border-gray-200"
          }`}
        >
          <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full bg-gradient-to-br ${step.color} opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500`} />

          <div className="flex items-start gap-3 relative">
            <div className={`w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center shadow-md group-hover:rotate-6 group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                <Clock className="h-3 w-3" /> {step.phase}
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{step.title}</h3>
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{step.desc}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5 relative">
            {step.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-slate-300">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                <span>{p}</span>
              </li>
            ))}
          </ul>

          {step.tip && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 relative">
              <Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{step.tip}</span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 relative">
            <button
              onClick={onToggle}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                done
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-200 hover:bg-gray-50"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {done ? "Sudah dipahami" : "Tandai selesai"}
            </button>
            {step.href && (
              <Link
                href={step.href}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-gradient-to-r ${step.color} shadow hover:shadow-md hover:gap-2 transition-all`}
              >
                {step.cta} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "spx_user_guide_done";

export default function UserGuidePage() {
  const [done, setDone] = useState<number[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setDone(saved);
    } catch {}
    setMounted(true);
  }, []);

  const toggle = (i: number) => {
    setDone((prev) => {
      const next = prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pct = Math.round((done.length / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16">
      <style>{`
        @keyframes guideFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @keyframes guideFadeUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes guideGradient { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        @keyframes guideLine { from { transform: scaleY(0) } to { transform: scaleY(1) } }
      `}</style>

      {/* Hero */}
      <div
        className="relative overflow-hidden text-white"
        style={{
          backgroundImage: "linear-gradient(120deg,#2563eb,#7c3aed,#db2777,#2563eb)",
          backgroundSize: "300% 300%",
          animation: "guideGradient 14s ease infinite",
        }}
      >
        <div className="absolute top-6 left-[8%] w-24 h-24 rounded-full bg-white/10 blur-sm" style={{ animation: "guideFloat 6s ease-in-out infinite" }} />
        <div className="absolute bottom-4 right-[12%] w-36 h-36 rounded-full bg-white/10 blur-sm" style={{ animation: "guideFloat 8s ease-in-out infinite 1s" }} />
        <div className="absolute top-10 right-[35%] w-10 h-10 rounded-full bg-white/20" style={{ animation: "guideFloat 5s ease-in-out infinite .5s" }} />

        <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-semibold" style={{ animation: "guideFadeUp .6s ease both" }}>
            <Sparkles className="h-3.5 w-3.5" /> User Guide · Closing LM
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ animation: "guideFadeUp .6s ease .1s both" }}>
            Roadmap Penggunaan Aplikasi
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/85 max-w-2xl mx-auto" style={{ animation: "guideFadeUp .6s ease .2s both" }}>
            Ikuti langkah-langkah berikut dari persiapan, input harian, hingga evaluasi mingguan & bulanan agar data Hub Anda selalu akurat.
          </p>

          {/* Progress */}
          <div className="mt-7 max-w-md mx-auto" style={{ animation: "guideFadeUp .6s ease .3s both" }}>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span>Progres pemahaman</span>
              <span>{mounted ? `${done.length}/${STEPS.length} langkah · ${pct}%` : "…"}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick flow */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Target, label: "Senin", text: "Target & Adjust", c: "text-amber-600" },
            { icon: Upload, label: "Harian", text: "Input Data", c: "text-violet-600" },
            { icon: LayoutDashboard, label: "Monitoring", text: "Dashboard Closing", c: "text-emerald-600" },
            { icon: Rocket, label: "Evaluasi", text: "Weekly & Monthly", c: "text-blue-600" },
          ].map((q, i) => (
            <div
              key={q.text}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md p-3 flex items-center gap-3 hover:-translate-y-1 transition-transform"
              style={{ animation: `guideFadeUp .5s ease ${0.4 + i * 0.1}s both` }}
            >
              <q.icon className={`h-6 w-6 ${q.c}`} />
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{q.label}</div>
                <div className="text-sm font-bold text-gray-800 dark:text-white">{q.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 mt-12">
        <div
          className="absolute left-9 sm:left-11 md:left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-400 via-purple-400 to-rose-400 origin-top"
          style={{ animation: "guideLine 1.6s ease-out both" }}
        />
        <div className="space-y-10">
          {STEPS.map((s, i) => (
            <StepCard key={s.title} step={s} index={i} done={done.includes(i)} onToggle={() => toggle(i)} />
          ))}
        </div>

        {/* Finish */}
        <div className="relative mt-12 text-center">
          <div
            className={`inline-flex flex-col items-center gap-2 px-6 py-5 rounded-2xl border shadow-sm transition-all duration-500 ${
              pct === 100
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent scale-105"
                : "bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-700 dark:text-slate-200"
            }`}
          >
            <Rocket className={`h-8 w-8 ${pct === 100 ? "animate-bounce" : "text-gray-400"}`} />
            <div className="font-bold">{pct === 100 ? "Mantap! Anda siap menggunakan Closing LM 🎉" : "Selesaikan semua langkah di atas"}</div>
            <div className="text-xs opacity-80">Progres tersimpan otomatis di browser Anda.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

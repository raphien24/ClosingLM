"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PirateBackground } from "@/components/pirate/PirateBackground";
import { Anchor, Compass, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    // Redirect ke dashboard dengan parameter sail=1 untuk memicu animasi POV kapten
    await signIn("google", { callbackUrl: "/dashboard?sail=1" });
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-between">
      {/* 3D Animated Pirate Ship & Ocean Background */}
      <PirateBackground />

      {/* Top Header / Branding Bar */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-950/70 border border-amber-400/40 p-1 shadow-lg flex items-center justify-center">
            <Anchor className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-300 drop-shadow-sm">
              SPX JTT08 · FLEET
            </p>
            <p className="text-[10px] text-blue-200/80 font-medium leading-none">
              Last Mile Operations
            </p>
          </div>
        </div>

        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-blue-400/30 text-blue-200 text-xs font-semibold backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sistem Siaga Operasional</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex-1 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
        {/* Left Side: Cinematic Title & Pirate Slogan (Desktop) */}
        <div className="hidden lg:flex flex-col max-w-xl text-white space-y-4 select-none pr-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/70 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md w-fit shadow-lg">
            <Compass className="h-4 w-4 animate-spin text-amber-400" style={{ animationDuration: "12s" }} />
            <span>Kapal Komando Last Mile JTT08</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.15] drop-shadow-md">
            Mengarungi Samudra{" "}
            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
              Closing &amp; Produktivitas
            </span>
          </h1>

          <p className="text-base text-blue-100/90 leading-relaxed drop-shadow-sm">
            Portal operasional terpadu Hub SPX JTT08. Pantau closing harian, KPI armada 2WH &amp; 4WH, hingga evaluasi bulanan bersama seluruh awak kapal.
          </p>

          <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-blue-500/20 backdrop-blur-md">
              <p className="font-extrabold text-amber-300 text-sm">Real-time Data</p>
              <p className="text-blue-200/80 text-[11px] mt-0.5">Auto sync &amp; verifikasi akurat</p>
            </div>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-blue-500/20 backdrop-blur-md">
              <p className="font-extrabold text-amber-300 text-sm">Armada Tangguh</p>
              <p className="text-blue-200/80 text-[11px] mt-0.5">Monitoring Ded., Plus &amp; Mitra</p>
            </div>
          </div>
        </div>

        {/* Right Side: Floating Login Box */}
        <div className="w-full sm:w-[420px] max-w-md lg:ml-auto">
          <div className="bg-slate-950/85 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] border border-amber-400/35 p-6 sm:p-8 hover-lift text-white transition-all duration-300">
            {/* Pirate Logo (Uploaded Image) */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-b from-amber-400 via-blue-900 to-slate-950 shadow-2xl shadow-blue-950/80 ring-4 ring-amber-400/60 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                  <img
                    src="/logo-jtt08-login.png"
                    alt="Logo Bajak Laut JTT08"
                    className="w-full h-full object-contain drop-shadow-md rounded-full"
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md">
                  PORTAL LM
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight text-center mt-4">
                Closing Report LM JTT08
              </h2>
              <p className="text-amber-300 font-bold text-xs mt-1 uppercase tracking-wider text-center">
                Last Mile Operations Portal
              </p>
            </div>

            {/* Welcome & Info */}
            <div className="text-center mb-6 px-1">
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Silakan login menggunakan akun Google terdaftar untuk menaiki kapal komando operasional Hub Anda.
              </p>
            </div>

            {/* Login Button with Google */}
            <Button
              onClick={handleLogin}
              loading={loading}
              size="lg"
              className="w-full py-4 text-sm font-bold bg-white hover:bg-slate-100 text-slate-900 rounded-xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3 border border-slate-200"
            >
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </Button>

            {/* Access notice */}
            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 mt-5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <span>Akses terproteksi &amp; diverifikasi per-Hub</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-4 py-4 text-center text-xs text-blue-200/70 select-none">
        <span>Made with 💖 by </span>
        <strong className="text-amber-300 font-bold">EW Team JTT08</strong>
        <span className="hidden sm:inline"> · Selamat Bertugas di Lautan Operasional</span>
      </footer>
    </div>
  );
}

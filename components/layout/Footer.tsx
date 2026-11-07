"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // Jangan tampilkan footer global pada halaman login
  if (pathname === "/login") {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <img
            src="/logo-jtt08.png"
            alt="Logo JTT08"
            className="w-5 h-5 object-contain opacity-90"
          />
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Closing Report LM JTT08
          </span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span>Last Mile Operations &amp; Productivity System</span>
        </div>

        <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 px-3 py-1 rounded-full shadow-2xs hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all duration-300">
          <span>Made with</span>
          <span className="animate-heartbeat">💖</span>
          <span className="font-bold bg-gradient-to-r from-blue-800 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
            EW Team JTT08
          </span>
        </div>
      </div>
    </footer>
  );
}

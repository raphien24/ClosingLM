"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type PirateNavIconId =
  | "dashboard"
  | "input"
  | "productivity"
  | "sameday"
  | "guide"
  | "weekly"
  | "monthly"
  | "prod-input"
  | "targets"
  | "profile"
  | "users"
  | "hubs";

/**
 * Medali logo JTT08 berbingkai kemudi kapal bajak laut (ship's helm) dengan aksen kuningan antik.
 */
export function PirateHelmMedallion({ size = "md" }: { size?: "sm" | "md" }) {
  const isSm = size === "sm";
  const ringGradId = useId();
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center flex-shrink-0 select-none",
        isSm ? "w-10 h-10" : "w-11 h-11 sm:w-12 sm:h-12"
      )}
    >
      {/* Cahaya lentera hangat di belakang kemudi */}
      <div
        aria-hidden="true"
        className="absolute inset-0.5 rounded-full bg-amber-400/20 blur-[5px] opacity-70 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* Roda Kemudi Kapal Kuningan (berputar halus saat hover) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 48 48"
        className="absolute inset-0 w-full h-full text-amber-300/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)] transition-transform duration-700 ease-out group-hover:rotate-45"
        fill="none"
      >
        <defs>
          <linearGradient id={ringGradId} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        {/* Jari-jari & pegangan kemudi kapal */}
        {spokes.map((deg) => (
          <g key={deg} transform={`rotate(${deg} 24 24)`}>
            <line
              x1="24"
              y1="24"
              x2="24"
              y2="3.2"
              stroke={`url(#${ringGradId})`}
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <circle cx="24" cy="2.6" r="1.45" fill="#fde68a" />
          </g>
        ))}
        {/* Ring kayu mahoni & bingkai emas luar */}
        <circle cx="24" cy="24" r="18.2" stroke="#5c2d16" strokeWidth="2.8" />
        <circle cx="24" cy="24" r="18.2" stroke={`url(#${ringGradId})`} strokeWidth="1.5" />
      </svg>

      {/* Medali inti berisi Logo JTT08 */}
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-br from-[#1b2942] via-[#0d1626] to-[#19120b] ring-1 ring-amber-300/75 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center",
          isSm ? "w-7 h-7 p-0.5" : "w-8 h-8 sm:w-[34px] sm:h-[34px] p-1"
        )}
      >
        <img
          src="/logo-jtt08.png"
          alt="Logo JTT08"
          className="w-full h-full object-contain drop-shadow-xs"
        />
      </div>
    </div>
  );
}

/**
 * Watermark kompas mawar (compass rose) samar & stud kuningan di latar header kapal komando.
 */
export function DeckCompassWatermark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={cn(
        "w-28 h-28 text-amber-300/[0.11] pointer-events-none select-none",
        className
      )}
      fill="none"
    >
      <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" />
      <circle cx="60" cy="60" r="38" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="10" stroke="currentColor" strokeWidth="1.2" />
      {/* Bintang kompas utama (Utara, Selatan, Timur, Barat) */}
      <path d="M60 4 L66 54 L60 60 L54 54 Z" fill="currentColor" />
      <path d="M60 116 L66 66 L60 60 L54 66 Z" fill="currentColor" opacity="0.6" />
      <path d="M4 60 L54 54 L60 60 L54 66 Z" fill="currentColor" opacity="0.6" />
      <path d="M116 60 L66 54 L60 60 L66 66 Z" fill="currentColor" />
      {/* Garis diagonal sekunder */}
      <path d="M22 22 L56 52 L60 60 L52 56 Z" fill="currentColor" opacity="0.45" />
      <path d="M98 22 L68 56 L60 60 L64 52 Z" fill="currentColor" opacity="0.45" />
      <path d="M22 98 L52 64 L60 60 L56 68 Z" fill="currentColor" opacity="0.45" />
      <path d="M98 98 L64 68 L60 60 L68 64 Z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

/**
 * Ikon vektor bertema bajak laut / bahari seragam untuk seluruh navigasi portal.
 */
export function PirateNavIcon({
  id,
  className,
}: {
  id: PirateNavIconId;
  className?: string;
}) {
  const cls = cn("w-4 h-4 flex-shrink-0", className);

  switch (id) {
    case "dashboard":
      // Kompas Kapten
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polygon points="15.5,8.5 13.4,13.4 8.5,15.5 10.6,10.6" fill="currentColor" fillOpacity="0.24" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" />
        </svg>
      );

    case "input":
      // Jangkar Dermaga Kapal
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5.5" r="2.2" />
          <path d="M12 7.8V20.5" />
          <path d="M8.5 11.2h7" />
          <path d="M5 13.8a7 7 0 0 0 14 0" />
          <path d="M4.2 14.2 5 12.2l1.8 1.2M19.8 14.2 19 12.2l-1.8 1.2" />
        </svg>
      );

    case "productivity":
      // Kapal Layar / Armada Bajak Laut
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.2v11.5" />
          <path d="M12 4.2c3.5 1.8 5.2 4.8 5.6 8.2H12" fill="currentColor" fillOpacity="0.22" />
          <path d="M10 6.5c-2.3 1.4-3.6 3.5-4 5.9h4" />
          <path d="M3.5 15.2h17l-2.1 4.2H5.6z" fill="currentColor" fillOpacity="0.16" />
          <path d="M2.5 21.2c2-1 3.8-1 5.5 0s3.5 1 5.5 0 3.5-1 5.5 0" />
        </svg>
      );

    case "guide":
      // Gulungan Peta Harta Karun
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6.2c0-1.1.9-2 2-2h11.2a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2H6.5" />
          <path d="M6.5 19.7a2.2 2.2 0 0 1-2.5-2.2V6.2" />
          <path d="M8.5 9.2h6.8M8.5 12.8h3.5" />
          <path d="m14.2 13.5 3 3m0-3-3 3" />
        </svg>
      );

    case "weekly":
      // Grafik Barometer Armada
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5h16" />
          <rect x="6" y="12" width="2.8" height="5.5" rx="0.8" fill="currentColor" fillOpacity="0.22" />
          <rect x="10.6" y="8" width="2.8" height="9.5" rx="0.8" fill="currentColor" fillOpacity="0.3" />
          <rect x="15.2" y="4.5" width="2.8" height="13" rx="0.8" fill="currentColor" fillOpacity="0.4" />
        </svg>
      );

    case "monthly":
      // Buku Log Pelayaran Bulanan
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="16" height="15" rx="2.5" />
          <path d="M8 3v3.5M16 3v3.5M4 9.5h16" />
          <path d="m12 12.4.9 1.8 2 .3-1.45 1.4.34 2-1.79-.94-1.79.94.34-2-1.45-1.4 2-.3z" fill="currentColor" fillOpacity="0.24" />
        </svg>
      );

    case "prod-input":
      // Catatan Log Muatan Kapal
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h9.5L19 7.5V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5.5A1.5 1.5 0 0 1 6 4z" />
          <path d="M15 4v4h4M8.5 11.5h7M8.5 15.5h5" />
        </svg>
      );

    case "targets":
      // Astrolabe / Bidikan Target Pelayaran
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );

    case "profile":
      // Lencana Kapten
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8.2" r="3.4" />
          <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </svg>
      );

    case "users":
      // Awak Kapal (Crew)
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9.5" cy="8" r="3" />
          <path d="M4 19a5.5 5.5 0 0 1 11 0" />
          <path d="M18 8.5v5M15.5 11h5" />
        </svg>
      );

    case "hubs":
      // Pelabuhan / Mercusuar Hub
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 6.5h5l1.5 13h-8z" fill="currentColor" fillOpacity="0.16" />
          <path d="M12 3 9 6.5h6zM7 19.5h10M9.8 11h4.4M9.3 15h5.4" />
        </svg>
      );

    case "sameday":
      // Kronometer Cepat Sameday
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="13" r="7.5" fill="currentColor" fillOpacity="0.14" />
          <path d="M10 3h4M12 3v2.5M12 9.5v3.5l2.5 1.8" />
          <path d="M18.2 6.8 19.6 5.4" />
        </svg>
      );
  }
}

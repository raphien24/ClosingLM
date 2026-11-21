"use client";

import { useEffect, useState } from "react";
import { Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProfileAvatarFrameProps {
  src?: string | null;
  alt?: string;
  fallbackLetter: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  isConsistent?: boolean;
  consistencyReason?: string;
  showPlaque?: boolean;
  ringClassName?: string;
  fallbackClassName?: string;
  className?: string;
}

const SIZE_CONFIG = {
  xs: {
    box: "w-7 h-7",
    text: "text-xs",
    pad: "p-[2px]",
    crown: "w-3.5 h-3.5 -top-1 -right-1",
    crownIcon: "w-2 h-2",
    plaque: "hidden",
  },
  sm: {
    box: "w-8 h-8",
    text: "text-xs",
    pad: "p-[2.5px]",
    crown: "w-4 h-4 -top-1 -right-1",
    crownIcon: "w-2.5 h-2.5",
    plaque: "-bottom-2 px-1.5 py-[1px] text-[8px]",
  },
  md: {
    box: "w-10 h-10",
    text: "text-sm",
    pad: "p-[3px]",
    crown: "w-4 h-4 -top-1 -right-1",
    crownIcon: "w-2.5 h-2.5",
    plaque: "-bottom-2 px-2 py-[1.5px] text-[9px]",
  },
  lg: {
    box: "w-12 h-12",
    text: "text-base",
    pad: "p-[3px]",
    crown: "w-5 h-5 -top-1 -right-1",
    crownIcon: "w-3 h-3",
    plaque: "-bottom-2.5 px-2.5 py-[2px] text-[9px]",
  },
  xl: {
    box: "w-24 h-24",
    text: "text-3xl",
    pad: "p-[4px]",
    crown: "w-7 h-7 -top-1.5 -right-1.5",
    crownIcon: "w-4 h-4",
    plaque: "-bottom-3 px-3 py-1 text-[11px]",
  },
} as const;

export function ConsistentBadgePill({
  reason,
  compact = false,
  className,
}: {
  reason?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      title={reason || "Konsisten mengisi Closing & Productivity selama 1 bulan penuh"}
      className={cn(
        "relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-amber-200/90 bg-gradient-to-r from-[#78350f] via-[#d97706] to-[#92400e] text-amber-50 font-extrabold tracking-wide shadow-[0_2px_10px_rgba(245,158,11,0.45)] select-none",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[10px]",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/55 to-transparent consistent-plaque-shine"
      />
      <Crown className={cn("relative z-10 text-yellow-200 flex-shrink-0", compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
      <span className="relative z-10 whitespace-nowrap">Si Paling Konsisten</span>
    </span>
  );
}

export function ProfileAvatarFrame({
  src,
  alt = "",
  fallbackLetter,
  size = "sm",
  isConsistent = false,
  consistencyReason,
  showPlaque = true,
  ringClassName = "ring-2 ring-amber-400/75",
  fallbackClassName = "bg-gradient-to-br from-amber-500 via-amber-700 to-[#4a1812] text-amber-50",
  className,
}: ProfileAvatarFrameProps) {
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    setImgBroken(false);
  }, [src]);

  const cfg = SIZE_CONFIG[size];
  const validSrc = Boolean(src) && !imgBroken;

  const innerAvatar = validSrc ? (
    <img
      src={src!}
      alt={alt}
      onError={() => setImgBroken(true)}
      className="w-full h-full rounded-full object-cover block"
    />
  ) : (
    <div
      className={cn(
        "w-full h-full rounded-full flex items-center justify-center font-extrabold shadow-xs",
        cfg.text,
        fallbackClassName
      )}
    >
      {fallbackLetter}
    </div>
  );

  if (!isConsistent) {
    return (
      <div
        className={cn(
          "relative rounded-full overflow-hidden flex-shrink-0",
          cfg.box,
          ringClassName,
          className
        )}
      >
        {innerAvatar}
      </div>
    );
  }

  return (
    <div
      title={consistencyReason || "Si Paling Konsisten · Closing & Productivity penuh 1 bulan"}
      className={cn(
        "relative inline-flex items-center justify-center flex-shrink-0 rounded-full",
        cfg.box,
        showPlaque && size === "xl" && "mb-2.5",
        showPlaque && (size === "lg" || size === "md") && "mb-1.5",
        className
      )}
    >
      {/* Lapisan cincin emas berputar + efek pendaran berkilau */}
      <div
        className={cn(
          "relative w-full h-full rounded-full consistent-aura-halo",
          cfg.pad
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full consistent-ring-conic"
        />
        <div className="relative z-10 w-full h-full rounded-full p-[1.5px] bg-[#0f1726]">
          <div className="w-full h-full rounded-full overflow-hidden">
            {innerAvatar}
          </div>
        </div>
      </div>

      {/* Mahkota & kilau berlian di sudut kanan atas bingkai */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute z-20 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 border border-amber-50 text-[#3b1d02] flex items-center justify-center shadow-[0_0_8px_rgba(253,224,71,0.85)]",
          cfg.crown
        )}
      >
        <Crown className={cfg.crownIcon} />
      </span>

      {size === "xl" && (
        <Sparkles
          aria-hidden="true"
          className="absolute -top-1 -left-1 z-20 w-4 h-4 text-yellow-200 drop-shadow-[0_0_6px_rgba(253,224,71,0.9)] consistent-sparkle"
        />
      )}

      {/* Plakat berkilau bertuliskan "Si Paling Konsisten" */}
      {showPlaque && size !== "xs" && (
        <span
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1 overflow-hidden rounded-full border border-amber-200/95 bg-gradient-to-r from-[#78350f] via-[#d97706] to-[#92400e] text-amber-50 font-black uppercase tracking-wider shadow-[0_3px_12px_rgba(245,158,11,0.65)] whitespace-nowrap pointer-events-none",
            cfg.plaque
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent consistent-plaque-shine"
          />
          <span className="relative z-10">✦ Si Paling Konsisten ✦</span>
        </span>
      )}
    </div>
  );
}

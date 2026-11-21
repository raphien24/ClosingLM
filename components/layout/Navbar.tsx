"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useUserProfileDisplay } from "@/hooks/useAuth";
import {
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ClosingCountdownWidget } from "./ClosingCountdownWidget";
import { MaritimeWaveBackdrop } from "@/components/productivity/MaritimeAnimations";
import {
  DeckCompassWatermark,
  PirateHelmMedallion,
  PirateNavIcon,
  type PirateNavIconId,
} from "./PirateNavEmblems";

interface NavItem {
  href: string;
  label: string;
  iconId: PirateNavIconId;
  badge?: string;
}

const mainLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard Closing", iconId: "dashboard" },
  { href: "/input", label: "Input Data", iconId: "input" },
  { href: "/monitor-sameday", label: "Monitor Sameday", iconId: "sameday" },
];

const guideLink: NavItem = {
  href: "/guide",
  label: "User Guide",
  iconId: "guide",
};

const productivityLinks: NavItem[] = [
  { href: "/productivity/all-hubs", label: "Productivity All Hub", iconId: "hubs" },
  { href: "/productivity/weekly", label: "Weekly Productivity", iconId: "weekly" },
  { href: "/productivity/monthly", label: "Monthly Productivity", iconId: "monthly" },
  { href: "/input?tab=productivity", label: "Input Productivity", iconId: "prod-input" },
  { href: "/productivity/targets", label: "Adjust Target", iconId: "targets" },
];

function isRouteActive(href: string, pathname: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function getDesktopTabClasses(active: boolean) {
  return cn(
    "relative flex items-center gap-1.5 lg:gap-2 px-2.5 xl:px-3 py-1.5 rounded-xl border text-xs lg:text-[13px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex-shrink-0",
    active
      ? "bg-gradient-to-b from-[#7a211b]/95 via-[#541614]/95 to-[#2d0c0e]/95 text-amber-100 border-amber-400/80 shadow-[0_3px_14px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(253,230,138,0.3)] -translate-y-0.5"
      : "bg-white/[0.03] text-amber-50/90 border-amber-400/15 hover:text-amber-100 hover:bg-amber-400/12 hover:border-amber-400/45 hover:-translate-y-0.5"
  );
}

function getDropdownItemClasses(active: boolean, tone: "brass" | "emerald" = "brass") {
  if (active) {
    return tone === "emerald"
      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/45 font-semibold"
      : "bg-gradient-to-r from-[#6d1f19]/85 to-[#481414]/85 text-amber-100 border border-amber-400/55 font-semibold shadow-xs";
  }
  return "text-slate-200 border border-transparent font-medium hover:bg-amber-400/12 hover:text-amber-100 hover:border-amber-400/25";
}

function getDrawerItemClasses(active: boolean, isDark: boolean, tone: "brass" | "emerald" = "brass") {
  if (active) {
    return tone === "emerald"
      ? "bg-gradient-to-r from-emerald-700 to-teal-700 text-emerald-50 border border-emerald-400/60 shadow-md font-bold"
      : "bg-gradient-to-r from-[#76201a] via-[#581715] to-[#391011] text-amber-100 border border-amber-400/70 shadow-md font-bold";
  }
  return isDark
    ? "text-amber-50/85 border border-transparent hover:bg-amber-400/10 hover:text-amber-100 hover:border-amber-400/25"
    : "text-[#352312] border border-transparent hover:bg-amber-900/10 hover:text-[#1b1107] hover:border-amber-700/25";
}

function ActiveKeelGlow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent"
    />
  );
}

function BrassDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-5 w-px bg-gradient-to-b from-transparent via-amber-400/45 to-transparent flex-shrink-0",
        className
      )}
    />
  );
}

function DrawerNavSection({
  title,
  items,
  pathname,
  isDark,
  exact = false,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  isDark: boolean;
  exact?: boolean;
  onNavigate: () => void;
}) {
  return (
    <div>
      <p
        className={cn(
          "px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em]",
          isDark ? "text-amber-300/75" : "text-[#8a5724]"
        )}
      >
        {title}
      </p>
      <div className="space-y-1">
        {items.map(({ href, label, iconId, badge }) => {
          const active = isRouteActive(href, pathname, exact);
          const isHubs = iconId === "hubs";
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                getDrawerItemClasses(active, isDark, isHubs ? "emerald" : "brass")
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <PirateNavIcon
                  id={iconId}
                  className={cn(
                    active
                      ? "text-amber-200"
                      : isHubs
                      ? isDark
                        ? "text-emerald-400"
                        : "text-emerald-700"
                      : isDark
                      ? "text-amber-300/70"
                      : "text-[#8a5724]"
                  )}
                />
                <span className="truncate">{label}</span>
              </span>
              {badge && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                    active
                      ? "bg-white/15 border-white/25 text-white"
                      : isDark
                      ? "bg-emerald-500/20 border-emerald-400/35 text-emerald-300"
                      : "bg-emerald-100 border-emerald-300 text-emerald-800"
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Bilah navigasi utama bergaya Quarterdeck Kapal Bajak Laut (kayu mahoni gelap,
 * aksen kuningan antik, lambang kemudi kapal, dan kronometer saku closing).
 */
export function Navbar() {
  const pathname = usePathname();
  const { user, hubName, isSuperAdmin, isOwnerAdmin, displayName, avatarSrc } =
    useUserProfileDisplay();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [prodMenuOpen, setProdMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const saved = localStorage.getItem("jtt08_theme");
    const darkActive =
      saved === "dark" || document.documentElement.classList.contains("dark");
    setIsDark(darkActive);
    document.documentElement.classList.toggle("dark", darkActive);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    try {
      localStorage.setItem("jtt08_theme", nextDark ? "dark" : "light");
    } catch {}
  };

  const isProdActive = pathname.startsWith("/productivity");

  const visibleProductivityLinks = productivityLinks.filter(
    (item) => item.href !== "/productivity/all-hubs" || isSuperAdmin
  );

  const accessLinks: NavItem[] = [
    { href: "/profile", label: "Edit Profil", iconId: "profile" },
    { href: "/users", label: "Tambahkan Pengguna", iconId: "users" },
    ...(isSuperAdmin
      ? [{ href: "/hubs/new", label: "Tambahkan Hub Baru", iconId: "hubs" as const, badge: "Admin" }]
      : []),
    ...(isOwnerAdmin
      ? [{ href: "/admin/manage", label: "Manage Admin", iconId: "admin" as const, badge: "Owner" }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#111b2c]/98 via-[#19273f]/98 to-[#111c2e]/98 dark:from-[#060b14]/98 dark:via-[#0b1526]/98 dark:to-[#070d18]/98 backdrop-blur-md border-b border-amber-400/45 dark:border-amber-400/35 shadow-[0_6px_26px_-6px_rgba(6,10,20,0.65),0_1px_0_0_rgba(251,191,36,0.18)] transition-colors">
      {/* Lapisan atmosfer geladak kapal: ombak laut tipis, cahaya lentera, dan mawar kompas */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.15),transparent_52%),radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.11),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.1),transparent_50%),radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.1),transparent_55%)]" />
        {/* Garis sambungan papan geladak halus */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(253,230,138,0.6) 0px, rgba(253,230,138,0.6) 1px, transparent 1px, transparent 140px)",
          }}
        />
        <div className="hidden md:block absolute -top-5 left-[44%] -translate-x-1/2">
          <DeckCompassWatermark />
        </div>
        <DeckCompassWatermark className="hidden xl:block absolute -bottom-10 right-[18%] opacity-75" />
        <MaritimeWaveBackdrop compact className="opacity-65" />
      </div>

      <div className="relative z-10 w-full px-3 sm:px-4 xl:px-5">
        <div className="flex items-center h-16 md:h-20 gap-1.5 lg:gap-2.5">
          {/* Tombol Drawer Mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-1 rounded-xl border border-amber-400/35 bg-[#162339]/80 text-amber-100 hover:bg-[#1e2f4b] hover:border-amber-300/70 transition-colors focus:outline-none"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo + Judul Bergaya Kemudi Kapten */}
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 lg:gap-2.5 mr-1 py-1 focus:outline-none min-w-0 flex-shrink-0"
          >
            <PirateHelmMedallion size="md" />
            <div className="flex flex-col min-w-0">
              <p className="text-xs xl:text-sm font-extrabold tracking-tight bg-gradient-to-r from-[#fffbeb] via-[#fde68a] to-[#f59e0b] bg-clip-text text-transparent group-hover:from-white group-hover:to-amber-300 transition-all truncate">
                <span className="lg:hidden">Closing LM</span>
                <span className="hidden lg:inline">Closing Report LM JTT08</span>
              </p>
              <p className="flex items-center gap-1.5 text-[10px] xl:text-[11px] font-semibold text-amber-200/75 leading-tight truncate">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-400/85 flex-shrink-0" />
                <span className="lg:hidden truncate">{hubName || "JTT08"}</span>
                <span className="hidden lg:inline truncate">Last Mile Operations Portal</span>
              </p>
            </div>
          </Link>

          <BrassDivider className="hidden md:block" />

          {/* Navigasi Utama Desktop */}
          <nav className="hidden md:flex items-center gap-1 xl:gap-1.5 flex-1 min-w-0">
            {mainLinks.map(({ href, label, iconId }) => {
              const active = isRouteActive(href, pathname);
              return (
                <Link key={href} href={href} className={getDesktopTabClasses(active)}>
                  <PirateNavIcon
                    id={iconId}
                    className={active ? "text-amber-300" : "text-amber-300/75"}
                  />
                  <span>{label}</span>
                  {active && <ActiveKeelGlow />}
                </Link>
              );
            })}

            {/* Dropdown Produktivitas Armada */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProdMenuOpen((p) => !p)}
                className={getDesktopTabClasses(isProdActive)}
              >
                <PirateNavIcon
                  id="productivity"
                  className={isProdActive ? "text-amber-300" : "text-amber-300/75"}
                />
                <span>Productivity</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isProdActive ? "text-amber-200" : "text-amber-200/70",
                    prodMenuOpen && "rotate-180"
                  )}
                />
                {isProdActive && <ActiveKeelGlow />}
              </button>

              {prodMenuOpen && (
                <div className="animate-dropdown absolute top-full left-0 mt-2.5 w-60 bg-[#0d1727]/98 backdrop-blur-md rounded-2xl border border-amber-400/45 shadow-[0_18px_40px_-8px_rgba(2,6,15,0.85)] overflow-hidden z-50">
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                  <div className="px-3.5 pt-2.5 pb-1.5 flex items-center gap-1.5 border-b border-amber-400/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/80">
                      Navigasi Produktivitas
                    </span>
                  </div>
                  <div className="py-1.5 px-1.5 space-y-0.5">
                    {visibleProductivityLinks.map(({ href, label, iconId }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setProdMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors",
                            getDropdownItemClasses(active)
                          )}
                        >
                          <PirateNavIcon
                            id={iconId}
                            className={active ? "text-amber-300" : "text-amber-300/70"}
                          />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Panduan Pengguna */}
            {(() => {
              const active = isRouteActive(guideLink.href, pathname);
              return (
                <Link href={guideLink.href} className={getDesktopTabClasses(active)}>
                  <PirateNavIcon
                    id={guideLink.iconId}
                    className={active ? "text-amber-300" : "text-amber-300/75"}
                  />
                  <span>{guideLink.label}</span>
                  {active && <ActiveKeelGlow />}
                </Link>
              );
            })()}
          </nav>

          {/* Aksi Kanan: Kronometer Batas Closing, Lentera Tema, & Profil Kapten */}
          <div className="flex items-center gap-1.5 xl:gap-2 ml-auto flex-shrink-0">
            <ClosingCountdownWidget />

            {/* Toggle Lentera Siang / Malam */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
              aria-label="Toggle Light/Dark Mode"
              className="relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-amber-400/40 bg-[#121e33]/90 hover:bg-[#192944] hover:border-amber-300/75 shadow-[inset_0_1px_0_rgba(253,230,138,0.14)] transition-all duration-200 cursor-pointer group flex-shrink-0"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-300 group-hover:rotate-45 transition-transform duration-300" />
                  <span className="hidden lg:inline text-xs font-semibold text-amber-100">
                    Light
                  </span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-amber-200 group-hover:-rotate-12 transition-transform duration-300" />
                  <span className="hidden lg:inline text-xs font-semibold text-amber-50">
                    Dark
                  </span>
                </>
              )}
            </button>

            <BrassDivider className="hidden md:block" />

            {/* Menu Profil Kapten */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setUserMenuOpen((p) => !p)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-amber-400/45 bg-gradient-to-b from-[#17243b]/95 to-[#0f1929]/95 hover:border-amber-300/80 hover:from-[#1d2d49] hover:to-[#132033] shadow-[inset_0_1px_0_rgba(253,230,138,0.16),0_2px_10px_rgba(0,0,0,0.3)] transition-all duration-200 cursor-pointer"
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-amber-400/75"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 via-amber-700 to-[#4a1812] ring-2 ring-amber-300/65 flex items-center justify-center text-amber-50 font-extrabold text-xs shadow-xs">
                    {(displayName || user?.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:flex flex-col items-start text-left max-w-[92px]">
                  <p className="text-xs font-bold text-amber-50 leading-tight truncate w-full">
                    {displayName}
                  </p>
                  <p className="text-[10px] font-semibold text-amber-300/80 leading-tight truncate w-full">
                    {hubName || "All Hub"}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-amber-300/80 transition-transform duration-200",
                    userMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="animate-dropdown absolute right-0 mt-2.5 w-64 bg-[#0d1727]/98 backdrop-blur-md rounded-2xl shadow-[0_18px_42px_-8px_rgba(2,6,15,0.85)] border border-amber-400/45 overflow-hidden z-50">
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                  <div className="px-4 py-3 bg-gradient-to-br from-[#182236] to-[#0f1726] border-b border-amber-400/20">
                    <p className="text-sm font-bold text-amber-50 truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user?.email}
                    </p>
                    <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 bg-amber-400/15 text-amber-200 border border-amber-400/40 text-xs rounded-full font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {hubName || "All Hub"}
                    </span>
                  </div>

                  <div className="py-1.5 px-1.5 border-b border-amber-400/15 space-y-0.5">
                    {accessLinks.map(({ href, label, iconId, badge }) => {
                      const active = pathname === href;
                      const isHubs = iconId === "hubs" || iconId === "admin";
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setUserMenuOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors",
                            getDropdownItemClasses(active, isHubs ? "emerald" : "brass")
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <PirateNavIcon
                              id={iconId}
                              className={
                                active
                                  ? isHubs
                                    ? "text-emerald-300"
                                    : "text-amber-300"
                                  : isHubs
                                  ? "text-emerald-400/80"
                                  : "text-amber-300/70"
                              }
                            />
                            <span>{label}</span>
                          </span>
                          {badge && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-200 border-emerald-400/35">
                              {badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tutup dropdown saat klik area luar */}
      {(prodMenuOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-40 hidden md:block"
          onClick={() => {
            setProdMenuOpen(false);
            setUserMenuOpen(false);
          }}
        />
      )}

      {/* Drawer Navigasi Mobile via Portal */}
      {mounted &&
        createPortal(
          <div
            className={cn(
              "fixed inset-0 z-[9999] md:hidden transition-all duration-300",
              mobileOpen
                ? "visible opacity-100 pointer-events-auto"
                : "invisible opacity-0 pointer-events-none"
            )}
          >
            <div
              className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity duration-300"
              onClick={() => setMobileOpen(false)}
            />

            <aside
              className={cn(
                "fixed top-0 bottom-0 left-0 w-[300px] max-w-[86vw] h-full h-[100dvh] shadow-2xl flex flex-col z-[10000] transition-transform duration-300 ease-out border-r border-amber-400/45",
                isDark ? "bg-[#0a1322] text-amber-50" : "bg-[#f8f0df] text-[#2b1d0e]",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              {/* Rel kuningan atas */}
              <div className="h-[3px] w-full bg-gradient-to-r from-[#6b3e12] via-[#fbbf24] to-[#6b3e12] flex-shrink-0" />

              {/* Header Drawer Bergaya Dek Kapten */}
              <div className="relative p-4 bg-gradient-to-r from-[#0e1726] via-[#17263d] to-[#0e1726] border-b border-amber-400/35 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PirateHelmMedallion size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-tight text-amber-100 leading-tight truncate">
                      Closing LM JTT08
                    </p>
                    <p className="text-[10px] font-medium text-amber-200/75 leading-tight truncate">
                      Last Mile Operations
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl border border-amber-400/30 bg-[#152238] text-amber-200 hover:text-white hover:border-amber-300/70 transition-colors focus:outline-none cursor-pointer"
                  aria-label="Tutup menu navigasi"
                  title="Minimize Menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Indikator Hub & Kronometer Batas Closing di Mobile */}
              <div className="px-3 pt-3 space-y-2 flex-shrink-0">
                {hubName && (
                  <div
                    className={cn(
                      "px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-semibold",
                      isDark
                        ? "bg-[#111e33] border-amber-400/30 text-amber-200"
                        : "bg-[#efe2c6] border-amber-700/25 text-[#432910]"
                    )}
                  >
                    <span className={isDark ? "text-amber-300/70" : "text-[#7a4b1e]"}>
                      Hub Operasional:
                    </span>
                    <span className="font-bold">{hubName}</span>
                  </div>
                )}

                <ClosingCountdownWidget variant="drawer" />
              </div>

              {/* Daftar Menu Scrollable */}
              <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4">
                <DrawerNavSection
                  title="Dek Utama"
                  items={mainLinks}
                  pathname={pathname}
                  isDark={isDark}
                  onNavigate={() => setMobileOpen(false)}
                />
                <DrawerNavSection
                  title="Fleet Productivity"
                  items={visibleProductivityLinks}
                  pathname={pathname}
                  isDark={isDark}
                  exact
                  onNavigate={() => setMobileOpen(false)}
                />
                <DrawerNavSection
                  title="Panduan"
                  items={[guideLink]}
                  pathname={pathname}
                  isDark={isDark}
                  onNavigate={() => setMobileOpen(false)}
                />
                <DrawerNavSection
                  title="Manajemen Akses"
                  items={accessLinks}
                  pathname={pathname}
                  isDark={isDark}
                  exact
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>

              {/* Footer Drawer: Tema, Info Kapten & Sign Out */}
              <div className="p-3 bg-gradient-to-r from-[#0d1625] via-[#132035] to-[#0d1625] border-t border-amber-400/35 space-y-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-semibold border border-amber-400/35 bg-[#15233a] text-amber-100 hover:border-amber-300/70 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isDark ? (
                      <Sun className="h-4 w-4 text-amber-300" />
                    ) : (
                      <Moon className="h-4 w-4 text-amber-200" />
                    )}
                    <span>{isDark ? "Tema: Mode Gelap (Dark)" : "Tema: Mode Terang (Light)"}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-200 border border-amber-400/30">
                    Ganti
                  </span>
                </button>

                <div className="flex items-center gap-2.5 px-1.5 py-1">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400/70"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-[#4a1812] ring-2 ring-amber-300/60 flex items-center justify-center text-amber-50 font-bold text-xs shadow-xs">
                      {(displayName || user?.email || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-50 truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-amber-200/65 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-bold text-rose-200 bg-rose-950/70 border border-rose-500/40 hover:bg-rose-900/80 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Akun
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </header>
  );
}

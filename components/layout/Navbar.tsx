"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Upload,
  LogOut,
  ChevronDown,
  BarChart2,
  Calendar,
  Target,
  ClipboardList,
  Sun,
  Moon,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard Closing", icon: LayoutDashboard },
  { href: "/input",     label: "Input Data",        icon: Upload },
  { href: "/guide",     label: "User Guide",        icon: BookOpen },
];

const productivityLinks = [
  { href: "/productivity/weekly",    label: "Weekly Productivity",  icon: BarChart2 },
  { href: "/productivity/monthly",   label: "Monthly Productivity", icon: Calendar },
  { href: "/input?tab=productivity", label: "Input Productivity",   icon: ClipboardList },
  { href: "/productivity/targets",   label: "Adjust Target",        icon: Target },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, hubName, hubUser } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [prodMenuOpen, setProdMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
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

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.06)] transition-all">
      {/* Top thin maritime navy-blue & gold accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-slate-900 via-blue-600 to-amber-500" />

      <div className="w-full px-3 sm:px-6">
        <div className="flex items-center h-16 gap-2">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="sm:hidden p-2 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors focus:outline-none"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-6 w-6 text-slate-800" />
          </button>

          {/* Logo + Title */}
          <Link
            href="/dashboard"
            className="group flex items-center gap-2.5 sm:gap-3 mr-2 sm:mr-4 py-1 focus:outline-none"
          >
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 p-1 shadow-md shadow-blue-950/15 ring-1 ring-amber-400/40 group-hover:scale-105 group-hover:shadow-lg group-hover:ring-amber-400 transition-all duration-300">
              <img
                src="/logo-jtt08.png"
                alt="Logo JTT08"
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </div>
            <div className="flex flex-col">
              <p className="text-xs sm:text-sm font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:to-indigo-600 transition-all">
                <span className="sm:hidden">Closing LM</span>
                <span className="hidden sm:inline">Closing Report LM JTT08</span>
              </p>
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 leading-tight">
                <span className="sm:hidden">{hubName || "JTT08"}</span>
                <span className="hidden sm:inline">Last Mile Operations Portal</span>
              </p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden sm:flex items-center gap-1.5 flex-1">
            {mainLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
                    active
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-600/25 -translate-y-0.5"
                      : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 hover:-translate-y-0.5"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}

            {/* Productivity dropdown */}
            <div className="relative">
              <button
                onClick={() => setProdMenuOpen((p) => !p)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer",
                  isProdActive
                    ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm shadow-blue-600/25 -translate-y-0.5"
                    : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 hover:-translate-y-0.5"
                )}
              >
                <BarChart2 className="h-4 w-4" />
                Productivity
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    prodMenuOpen && "rotate-180"
                  )}
                />
              </button>

              {prodMenuOpen && (
                <div className="animate-dropdown absolute top-full left-0 mt-2 w-56 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl py-1.5 z-50">
                  {productivityLinks.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setProdMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 mx-1.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                          active
                            ? "text-blue-700 bg-blue-50 font-semibold"
                            : "text-slate-700 hover:bg-slate-100/80 hover:translate-x-0.5"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            active ? "text-blue-600" : "text-slate-400"
                          )}
                        />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right actions: Theme Toggle + User menu */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Light / Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? "Ubah ke Light Mode" : "Ubah ke Dark Mode"}
              aria-label="Toggle Light/Dark Mode"
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all duration-200 cursor-pointer group"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
                  <span className="hidden md:inline text-xs font-semibold text-slate-700">
                    Light
                  </span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-600 group-hover:-rotate-12 group-hover:text-blue-600 transition-all duration-300" />
                  <span className="hidden md:inline text-xs font-semibold text-slate-700">
                    Dark
                  </span>
                </>
              )}
            </button>

            {/* User menu */}
            <div className="relative">
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-xs transition-all duration-200 cursor-pointer"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-7 h-7 rounded-full ring-2 ring-blue-500/20"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-xs">
                  <span className="text-white font-bold text-xs">
                    {(user?.name || user?.email || "U")[0].toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  {hubUser || user?.name}
                </p>
                <p className="text-[11px] font-semibold text-blue-600 leading-tight">
                  {hubName}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 hidden sm:block transition-transform duration-200",
                  userMenuOpen && "rotate-180"
                )}
              />
            </button>

            {userMenuOpen && (
              <div className="animate-dropdown absolute right-0 mt-2 w-60 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-900">
                    {hubUser || user?.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded-full font-semibold">
                    {hubName}
                  </span>
                </div>

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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

      {/* Click outside to close desktop dropdowns */}
      {(prodMenuOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-40 hidden sm:block"
          onClick={() => {
            setProdMenuOpen(false);
            setUserMenuOpen(false);
          }}
        />
      )}

      {/* Mobile Drawer (Sidebar) */}
      <div
        className={cn(
          "fixed inset-0 z-50 sm:hidden transition-all duration-300",
          mobileOpen
            ? "visible opacity-100 pointer-events-auto"
            : "invisible opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />

        {/* Sliding Sidebar Panel */}
        <aside
          className={cn(
            "fixed top-0 bottom-0 left-0 w-[285px] max-w-[85vw] bg-white border-r border-slate-200 shadow-2xl flex flex-col z-50 transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Drawer Header with Logo and Minimize / Close Button */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 p-1 shadow-md shadow-blue-950/15 ring-1 ring-amber-400/40">
                <img
                  src="/logo-jtt08.png"
                  alt="Logo JTT08"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-extrabold tracking-tight text-slate-900 leading-tight">
                  Closing LM JTT08
                </p>
                <p className="text-[10px] font-medium text-slate-500 leading-tight">
                  Last Mile Operations
                </p>
              </div>
            </div>

            {/* Minimize / Close Button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors focus:outline-none"
              aria-label="Tutup menu navigasi"
              title="Minimize Menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Hub Badge Indicator */}
          {hubName && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-blue-50/80 border border-blue-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px] font-medium">Hub Operasional:</span>
              <span className="font-bold text-blue-700 text-xs">{hubName}</span>
            </div>
          )}

          {/* Scrollable Navigation Menu List */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {/* Main Menu Section */}
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Menu Utama
              </p>
              <div className="space-y-1">
                {mainLinks.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                        active
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          active ? "text-white" : "text-slate-500"
                        )}
                      />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Productivity Section */}
            <div>
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Fleet Productivity
              </p>
              <div className="space-y-1">
                {productivityLinks.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150",
                        active
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          active ? "text-white" : "text-slate-500"
                        )}
                      />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Drawer Footer with User Info & Sign Out */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/80 space-y-2">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              {user?.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="w-8 h-8 rounded-full ring-2 ring-blue-500/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {hubUser || user?.name}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Keluar Akun
            </button>
          </div>
        </aside>
      </div>
    </header>
  );
}

"use client";

function WaveStrip({
  className,
  pathD,
}: {
  className: string;
  pathD: string;
}) {
  return (
    <div className={`flex w-[200%] h-full ${className}`}>
      {[0, 1].map((idx) => (
        <svg
          key={idx}
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-1/2 h-full flex-shrink-0"
        >
          <path d={pathD} fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Animasi SVG ombak laut berlapis untuk header/kartu tema maritim (Light & Dark Mode).
 */
export function MaritimeWaveBackdrop({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const heightCls = compact ? "h-8" : "h-12 sm:h-14";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden select-none ${heightCls} ${className}`}
    >
      {/* Ombak belakang (lebih lambat, fasa berbeda) */}
      <div className="absolute inset-0 text-sky-200 opacity-15">
        <WaveStrip
          className="animate-wave-slide-reverse"
          pathD="M0,56 C100,96 200,96 300,56 C400,16 500,16 600,56 C700,96 800,96 900,56 C1000,16 1100,16 1200,56 L1200,120 L0,120 Z"
        />
      </div>

      {/* Ombak depan */}
      <div className="absolute inset-0 text-cyan-300 opacity-20">
        <WaveStrip
          className="animate-wave-slide"
          pathD="M0,64 C100,20 200,20 300,64 C400,108 500,108 600,64 C700,20 800,20 900,64 C1000,108 1100,108 1200,64 L1200,120 L0,120 Z"
        />
      </div>
    </div>
  );
}

/**
 * Emblem animasi pelaut: perahu layar + ombak + kemudi kapal berputar pelan.
 */
export function SailorHelmVesselIcon() {
  return (
    <div
      aria-hidden="true"
      className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0c2238] via-[#123452] to-[#164560] border border-amber-400/50 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
    >
      {/* Kemudi kapal halus berputar lambat di latar belakang */}
      <svg
        viewBox="0 0 48 48"
        className="animate-helm-spin absolute inset-0 w-full h-full opacity-20 text-amber-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="24" cy="24" r="14" />
        <line x1="24" y1="4" x2="24" y2="44" />
        <line x1="4" y1="24" x2="44" y2="24" />
        <line x1="10" y1="10" x2="38" y2="38" />
        <line x1="38" y1="10" x2="10" y2="38" />
      </svg>

      {/* Siluet kapal berlayar mengikuti alunan ombak */}
      <svg
        viewBox="0 0 32 32"
        className="animate-ship-bob relative w-7 h-7"
        fill="none"
      >
        {/* Layar utama & depan */}
        <path d="M15 5 L15 20 L7 20 Z" className="fill-sky-200" />
        <path d="M16.8 7.5 L24.5 20 L16.8 20 Z" className="fill-amber-300" />
        {/* Lambung kapal */}
        <path
          d="M5 21.5 H27 L24 25.5 C22.8 26.4 9.2 26.4 8 25.5 Z"
          className="fill-white"
        />
      </svg>

      {/* Garis ombak kecil di dasar ikon */}
      <svg
        viewBox="0 0 40 8"
        className="absolute bottom-0 left-0 w-full h-2 text-cyan-300 opacity-75"
        preserveAspectRatio="none"
      >
        <path
          d="M0,4 Q5,0 10,4 T20,4 T30,4 T40,4 L40,8 L0,8 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/**
 * Ikon kompas maritim kecil dengan jarum bergerak halus.
 */
export function SailorCompassIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <g className="animate-compass-needle">
        <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * Emblem animasi pelaut khusus Closing Monitor: Menara Suar pelabuhan dengan sorot cahaya berayun di atas ombak.
 */
export function LighthouseBeaconIcon() {
  return (
    <div
      aria-hidden="true"
      className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0c2238] via-[#123452] to-[#164560] border border-amber-400/50 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
    >
      <svg viewBox="0 0 32 32" className="relative w-8 h-8" fill="none">
        {/* Sorot lampu menara suar */}
        <g className="animate-beacon-sweep">
          <polygon points="16,10 2,4 2,15" className="fill-amber-300/35" />
          <polygon points="16,10 30,4 30,15" className="fill-amber-300/35" />
        </g>
        {/* Puncak lentera menara */}
        <path d="M13.5 8 L16 5 L18.5 8 Z" className="fill-amber-300" />
        <rect x="14" y="8" width="4" height="3" rx="0.5" className="fill-amber-200" />
        {/* Badan menara suar */}
        <path d="M13.5 11 H18.5 L20 23 H12 Z" className="fill-white" />
        <path d="M13.1 14.5 H18.9 L19.2 17 H12.8 Z" className="fill-cyan-500/85" />
        <path d="M12.4 19.5 H19.6 L19.9 22 H12.1 Z" className="fill-cyan-500/85" />
        {/* Dasar batu pelabuhan */}
        <rect x="10" y="23" width="12" height="2.5" rx="1" className="fill-sky-200" />
      </svg>

      {/* Garis ombak kecil di dasar ikon */}
      <svg
        viewBox="0 0 40 8"
        className="absolute bottom-0 left-0 w-full h-2 text-cyan-300 opacity-75"
        preserveAspectRatio="none"
      >
        <path
          d="M0,4 Q5,0 10,4 T20,4 T30,4 T40,4 L40,8 L0,8 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/**
 * Emblem animasi pelaut khusus Pusat Input Data: Bendera kapal berkibar di atas buku log kapten & ombak dermaga.
 */
export function CargoLogbookIcon() {
  return (
    <div
      aria-hidden="true"
      className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0c2238] via-[#123452] to-[#164560] border border-amber-400/50 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
    >
      <svg viewBox="0 0 32 32" className="relative w-7 h-7" fill="none">
        {/* Tiang & Bendera Sinyal Kapal Berkibar */}
        <line x1="10" y1="5" x2="10" y2="17" stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" />
        <g className="animate-pennant-wave">
          <path d="M10.8 6 L23 8.5 L10.8 11.5 Z" className="fill-amber-300" />
        </g>
        {/* Buku Log / Cargo Ledger */}
        <rect x="7" y="15" width="18" height="10" rx="2" className="fill-white" />
        <line x1="11" y1="18.5" x2="21" y2="18.5" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="11" y1="21.5" x2="17.5" y2="21.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Garis ombak kecil di dasar ikon */}
      <svg
        viewBox="0 0 40 8"
        className="absolute bottom-0 left-0 w-full h-2 text-sky-300 opacity-75"
        preserveAspectRatio="none"
      >
        <path
          d="M0,4 Q5,0 10,4 T20,4 T30,4 T40,4 L40,8 L0,8 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/**
 * Emblem animasi pelaut khusus Adjust Target: Dial kompas navigasi & sapuan sonar kalibrasi target di atas ombak.
 */
export function MaritimeTargetCompassIcon() {
  return (
    <div
      aria-hidden="true"
      className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0c2238] via-[#123452] to-[#164560] border border-amber-400/50 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden"
    >
      <svg viewBox="0 0 32 32" className="relative w-8 h-8" fill="none">
        {/* Ring luar & dalam kalibrasi */}
        <circle cx="16" cy="15" r="10.5" stroke="#fde68a" strokeOpacity="0.45" strokeWidth="1.2" />
        <circle cx="16" cy="15" r="5.8" stroke="#7dd3fc" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 2" />
        {/* Garis bidik kardinal */}
        <line x1="16" y1="3" x2="16" y2="7" stroke="#fde68a" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="16" y1="23" x2="16" y2="27" stroke="#fde68a" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="4" y1="15" x2="8" y2="15" stroke="#fde68a" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="24" y1="15" x2="28" y2="15" stroke="#fde68a" strokeWidth="1.3" strokeLinecap="round" />
        {/* Sapuan sonar / kompas kalibrasi berputar halus */}
        <g className="animate-sonar-sweep">
          <path d="M16 15 L16 5.5 A9.5 9.5 0 0 1 24.3 10.4 Z" className="fill-amber-300/35" />
          <line x1="16" y1="15" x2="16" y2="5.5" stroke="#fcd34d" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        {/* Titik pusat target */}
        <circle cx="16" cy="15" r="2.2" className="fill-amber-300" />
        <circle cx="16" cy="15" r="1" className="fill-white" />
      </svg>

      {/* Garis ombak kecil di dasar ikon */}
      <svg
        viewBox="0 0 40 8"
        className="absolute bottom-0 left-0 w-full h-2 text-cyan-300 opacity-75"
        preserveAspectRatio="none"
      >
        <path
          d="M0,4 Q5,0 10,4 T20,4 T30,4 T40,4 L40,8 L0,8 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}

/**
 * Latar peta navigasi kapten (Captain's Logbook): garis koordinat laut halus & mawar kompas berputar pelan
 * untuk membedakan Hero dari ombak Navbar.
 */
export type NauticalBackdropVariant =
  | "dashboard"
  | "input"
  | "weekly"
  | "monthly"
  | "targets";

const BACKDROP_CHART_LABELS: Record<NauticalBackdropVariant, string[]> = {
  dashboard: ["07°09'S · 112°04'E", "JTT08 CHART"],
  input: ["PIER 08 · LOGBOOK", "CARGO MANIFEST"],
  weekly: ["SEN – MIN · ROUTE", "7-DAY VOYAGE"],
  monthly: ["4-WEEK HORIZON", "MONTHLY ARCHIVE"],
  targets: ["BEARING 045° · SONAR", "TARGET CALIBRATION"],
};

export function NauticalChartBackdrop({
  className = "",
  variant = "dashboard",
}: {
  className?: string;
  variant?: NauticalBackdropVariant;
}) {
  const [coordLeft, coordRight] = BACKDROP_CHART_LABELS[variant];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
    >
      {/* Grid koordinat tipis, pudar di sisi kiri agar teks Hero tetap bersih & tajam */}
      <div
        className="absolute inset-0 opacity-[0.055] dark:opacity-[0.08] [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.35)_32%,black_68%)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #0f4c5c 1px, transparent 1px), linear-gradient(to bottom, #0f4c5c 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Skala penggaris peta & koordinat maritim di tepi bawah-tengah */}
      <div className="hidden md:flex items-center gap-2 absolute bottom-1.5 left-[44%] text-[9px] font-mono tracking-widest text-teal-900/35 dark:text-cyan-200/30">
        <span>{coordLeft}</span>
        <span className="inline-block w-10 h-px bg-current opacity-60" />
        <span>{coordRight}</span>
      </div>

      {/* Peta kepulauan, kontur pantai, rute kapal beranimasi & waypoint (terkonsentrasi di tengah-kanan) */}
      <svg
        viewBox="0 0 760 120"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute inset-y-0 right-0 w-full md:w-[76%] h-full [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.3)_22%,black_48%)]"
        fill="none"
      >
        {variant === "dashboard" && (
          <>
            <path
              d="M150,120 C175,92 212,84 248,92 C278,98 302,82 328,88 C355,95 372,110 388,120 Z"
              className="fill-teal-700/[0.08] dark:fill-cyan-300/[0.08] stroke-teal-800/25 dark:stroke-cyan-300/25"
              strokeWidth="1.2"
            />
            <path
              d="M188,120 C205,104 232,100 256,105 C280,110 302,101 322,120"
              className="stroke-teal-800/18 dark:stroke-cyan-300/18"
              strokeWidth="0.9"
              strokeDasharray="3 3"
            />
            <path
              d="M445,0 C465,24 498,32 536,24 C568,18 602,38 634,26 C664,15 692,28 716,0 Z"
              className="fill-teal-700/[0.08] dark:fill-cyan-300/[0.08] stroke-teal-800/25 dark:stroke-cyan-300/25"
              strokeWidth="1.2"
            />
            <path
              d="M480,0 C498,16 524,20 552,14 C578,8 606,22 632,12"
              className="stroke-teal-800/18 dark:stroke-cyan-300/18"
              strokeWidth="0.9"
              strokeDasharray="3 3"
            />
            <path
              d="M525,84 C542,72 574,70 594,82 C612,92 608,108 584,110 C558,112 518,98 525,84 Z"
              className="fill-amber-700/[0.08] dark:fill-amber-300/[0.08] stroke-amber-800/25 dark:stroke-amber-300/25"
              strokeWidth="1.1"
            />
            <ellipse
              cx="412"
              cy="44"
              rx="26"
              ry="11"
              transform="rotate(-12 412 44)"
              className="fill-teal-700/[0.07] dark:fill-cyan-300/[0.08] stroke-teal-800/22 dark:stroke-cyan-300/22"
              strokeWidth="1"
            />
            <path
              d="M110,64 C210,48 295,66 375,58 C455,50 545,62 670,44"
              className="stroke-teal-800/15 dark:stroke-cyan-300/15"
              strokeWidth="0.8"
              strokeDasharray="2 4"
            />
            <path
              d="M175,78 Q295,30 412,62 T622,52"
              className="stroke-amber-700/35 dark:stroke-amber-300/35 animate-route-dash"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <g className="text-amber-700 dark:text-amber-300">
              <circle cx="175" cy="78" r="6" fill="currentColor" opacity="0.16" />
              <circle cx="175" cy="78" r="2.6" fill="currentColor" opacity="0.7" />
              <circle cx="412" cy="62" r="7" fill="currentColor" opacity="0.16" className="animate-pulse" />
              <circle cx="412" cy="62" r="3" fill="currentColor" opacity="0.78" />
              <circle cx="622" cy="52" r="6" fill="currentColor" opacity="0.18" />
              <circle cx="622" cy="52" r="2.6" fill="currentColor" opacity="0.75" />
            </g>
          </>
        )}

        {variant === "input" && (
          <>
            {/* Siluet dermaga & teluk pelabuhan bongkar-muat */}
            <path
              d="M200,120 L225,86 L310,86 L332,68 L415,68 L438,94 L535,94 L560,120 Z"
              className="fill-rose-700/[0.06] dark:fill-rose-300/[0.07] stroke-rose-800/22 dark:stroke-rose-300/22"
              strokeWidth="1.2"
            />
            <path
              d="M475,0 C505,28 565,36 628,22 C665,14 705,22 735,0 Z"
              className="fill-teal-700/[0.07] dark:fill-cyan-300/[0.08] stroke-teal-800/22 dark:stroke-cyan-300/22"
              strokeWidth="1.1"
            />
            {/* Jalur logistik dari dermaga menuju armada */}
            <path
              d="M195,52 C290,26 375,44 470,48 C550,52 615,32 680,44"
              className="stroke-amber-700/35 dark:stroke-amber-300/35 animate-route-dash"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <g className="text-rose-700 dark:text-amber-300">
              <rect x="268" y="76" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.25" />
              <circle cx="470" cy="48" r="7" fill="currentColor" opacity="0.15" className="animate-pulse" />
              <circle cx="470" cy="48" r="2.8" fill="currentColor" opacity="0.75" />
              <circle cx="680" cy="44" r="2.8" fill="currentColor" opacity="0.7" />
            </g>
          </>
        )}

        {variant === "weekly" && (
          <>
            {/* Gugusan pulau & busur pelayaran 7 hari (Sen–Min) */}
            <path
              d="M165,120 C198,88 265,86 308,104 C338,116 368,102 396,120 Z"
              className="fill-sky-700/[0.07] dark:fill-sky-300/[0.08] stroke-sky-800/22 dark:stroke-sky-300/22"
              strokeWidth="1.1"
            />
            <path
              d="M495,0 C525,30 578,36 635,18 C672,6 708,24 736,0 Z"
              className="fill-sky-700/[0.07] dark:fill-sky-300/[0.08] stroke-sky-800/22 dark:stroke-sky-300/22"
              strokeWidth="1.1"
            />
            <path
              d="M180,76 C265,30 375,32 455,62 C525,88 605,40 675,46"
              className="stroke-sky-700/35 dark:stroke-sky-300/35 animate-route-dash"
              strokeWidth="1.5"
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
            {/* 7 titik waypoint mingguan */}
            {[
              [180, 76],
              [262, 46],
              [348, 39],
              [432, 54],
              [512, 68],
              [594, 52],
              [675, 46],
            ].map(([cx, cy], i) => (
              <g key={i} className="text-sky-700 dark:text-sky-300">
                <circle cx={cx} cy={cy} r={i === 3 ? 6.5 : 4.5} fill="currentColor" opacity="0.16" />
                <circle
                  cx={cx}
                  cy={cy}
                  r={i === 3 ? 3 : 2.2}
                  fill="currentColor"
                  opacity={i === 3 ? 0.85 : 0.65}
                  className={i === 3 ? "animate-pulse" : undefined}
                />
              </g>
            ))}
          </>
        )}

        {variant === "monthly" && (
          <>
            {/* Kontur pasang surut & horizon pelayaran 4 minggu */}
            <path
              d="M140,120 C220,76 310,92 395,74 C480,56 565,88 665,68 L760,72 L760,120 Z"
              className="fill-emerald-700/[0.06] dark:fill-emerald-300/[0.07] stroke-emerald-800/20 dark:stroke-emerald-300/20"
              strokeWidth="1.1"
            />
            <path
              d="M170,66 Q290,26 420,52 T680,36"
              className="stroke-emerald-700/35 dark:stroke-emerald-300/35 animate-route-dash"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            {/* 4 penanda meridian mingguan */}
            {[230, 360, 495, 625].map((x, idx) => (
              <g key={x} className="text-emerald-700 dark:text-emerald-300">
                <line x1={x} y1="16" x2={x} y2="104" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.3" />
                <circle cx={x} cy={idx % 2 === 0 ? 48 : 42} r="3" fill="currentColor" opacity="0.7" />
              </g>
            ))}
          </>
        )}

        {variant === "targets" && (
          <>
            {/* Cincin radar kalibrasi jarak & garis bidik */}
            <g className="text-amber-700 dark:text-amber-300">
              <circle cx="545" cy="60" r="24" stroke="currentColor" strokeWidth="1" opacity="0.26" />
              <circle cx="545" cy="60" r="44" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.22" />
              <circle cx="545" cy="60" r="66" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 5" opacity="0.16" />
              <line x1="455" y1="60" x2="645" y2="60" stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 4" opacity="0.25" />
              <line x1="545" y1="6" x2="545" y2="114" stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 4" opacity="0.25" />
              <circle cx="545" cy="60" r="3.5" fill="currentColor" opacity="0.75" className="animate-pulse" />
            </g>
            <path
              d="M190,82 Q360,34 545,60"
              className="stroke-amber-700/35 dark:stroke-amber-300/35 animate-route-dash"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>

      {/* Mawar kompas navigasi berputar sangat pelan di pojok kanan */}
      <svg
        viewBox="0 0 160 160"
        className="animate-helm-spin absolute -right-5 -top-9 w-40 h-40 text-amber-800/[0.17] dark:text-amber-300/[0.16]"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="80" cy="80" r="64" strokeWidth="1.2" strokeDasharray="4 4" />
        <circle cx="80" cy="80" r="46" strokeWidth="1" />
        <circle cx="80" cy="80" r="10" strokeWidth="1.2" />
        <line x1="80" y1="6" x2="80" y2="154" strokeWidth="1" />
        <line x1="6" y1="80" x2="154" y2="80" strokeWidth="1" />
        <line x1="28" y1="28" x2="132" y2="132" strokeWidth="0.9" />
        <line x1="132" y1="28" x2="28" y2="132" strokeWidth="0.9" />
        <polygon points="80,14 86,70 80,62 74,70" fill="currentColor" stroke="none" />
        <polygon points="80,146 86,90 80,98 74,90" fill="currentColor" stroke="none" opacity="0.55" />
      </svg>
    </div>
  );
}

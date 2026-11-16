"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DashboardShipWipeOverlayProps {
  /** "curtain" menunggu transisi login selesai fade; "sailing" menjalankan kapal melintas + wipe reveal */
  phase: "curtain" | "sailing";
  /** Dipanggil ketika kapal selesai melintasi layar & tirai sudah terbuka penuh */
  onShipPassed: () => void;
}

interface SprayParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  life: number;
  maxLife: number;
}

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Menggambar satu layar persegi mengembang dengan pencahayaan senja & lipatan kain.
 */
function drawSquareSail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  width: number,
  height: number,
  belly: number,
  windPhase: number,
  withEmblem = false
) {
  const halfW = width * 0.5;
  const botY = topY + height;
  const flutter = Math.sin(windPhase) * (height * 0.018);

  // Kayu yardarm horizontal di puncak layar
  ctx.strokeStyle = "#3f2414";
  ctx.lineWidth = Math.max(2, height * 0.045);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 1.08, topY);
  ctx.lineTo(cx + halfW * 1.08, topY);
  ctx.stroke();

  // Kain layar mengembang ke kanan (haluan di kanan)
  const grad = ctx.createLinearGradient(cx - halfW, topY, cx + halfW + belly, botY);
  grad.addColorStop(0, "#d8c3a4");
  grad.addColorStop(0.38, "#f7e9d3");
  grad.addColorStop(0.75, "#fff8eb");
  grad.addColorStop(1, "#e7b98f");

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - halfW, topY);
  ctx.lineTo(cx + halfW, topY);
  ctx.quadraticCurveTo(
    cx + halfW + belly + flutter,
    topY + height * 0.52,
    cx + halfW * 0.94,
    botY
  );
  ctx.quadraticCurveTo(cx + belly * 0.25, botY - height * 0.07, cx - halfW * 0.96, botY);
  ctx.quadraticCurveTo(
    cx - halfW + belly * 0.52 + flutter * 0.5,
    topY + height * 0.5,
    cx - halfW,
    topY
  );
  ctx.closePath();

  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 74, 42, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Garis jahitan kain vertikal halus
  ctx.strokeStyle = "rgba(138, 92, 56, 0.16)";
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    const xOff = (i / 3) * halfW;
    ctx.beginPath();
    ctx.moveTo(cx + xOff, topY + 2);
    ctx.quadraticCurveTo(
      cx + xOff + belly * 0.58,
      topY + height * 0.5,
      cx + xOff * 0.94,
      botY - 2
    );
    ctx.stroke();
  }

  // Emblem kompas emas JTT08 di layar utama
  if (withEmblem) {
    const ex = cx + belly * 0.48;
    const ey = topY + height * 0.48;
    const er = Math.min(width, height) * 0.18;
    ctx.strokeStyle = "rgba(180, 95, 28, 0.48)";
    ctx.fillStyle = "rgba(217, 119, 6, 0.24)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(180, 83, 9, 0.45)";
    ctx.beginPath();
    ctx.moveTo(ex, ey - er * 0.85);
    ctx.lineTo(ex + er * 0.24, ey);
    ctx.lineTo(ex, ey + er * 0.85);
    ctx.lineTo(ex - er * 0.24, ey);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Menggambar bendera segitiga berkibar di puncak tiang.
 */
function drawPennant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  h: number,
  time: number,
  color: string
) {
  const wave1 = Math.sin(time * 10 + x * 0.02) * h * 0.35;
  const wave2 = Math.cos(time * 12 + x * 0.02) * h * 0.45;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - len * 0.45, y - h * 0.5 + wave1, x - len, y + wave2);
  ctx.quadraticCurveTo(x - len * 0.5, y + h * 0.55 + wave1, x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Menggambar kapal galleon penuh detail menghadap ke kanan (haluan di +X, buritan di -X).
 * Tinggi kapal diukur dari waterline (y = 0) hingga puncak tiang utama (-shipH).
 */
function drawFullGalleon(
  ctx: CanvasRenderingContext2D,
  shipH: number,
  time: number
) {
  const hullLen = shipH * 1.12;
  const hullDepth = shipH * 0.21;
  const sternX = -hullLen * 0.48;
  const bowX = hullLen * 0.52;

  // ── 1. Bowsprit (tiang cucur di haluan kanan) ──
  ctx.save();
  ctx.strokeStyle = "#3a1f10";
  ctx.lineWidth = Math.max(3, shipH * 0.011);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bowX * 0.84, -hullDepth * 0.72);
  ctx.lineTo(bowX + hullLen * 0.24, -hullDepth * 1.55);
  ctx.stroke();

  // Layar haluan (Jib triangles)
  ctx.fillStyle = "rgba(255, 245, 228, 0.94)";
  ctx.strokeStyle = "rgba(130, 82, 46, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bowX * 0.45, -shipH * 0.76);
  ctx.quadraticCurveTo(bowX * 0.96, -hullDepth * 2.25, bowX + hullLen * 0.2, -hullDepth * 1.48);
  ctx.quadraticCurveTo(bowX * 0.8, -hullDepth * 1.35, bowX * 0.46, -hullDepth * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ── 2. Tali temali (rigging stays & shrouds) ──
  ctx.strokeStyle = "rgba(44, 24, 12, 0.42)";
  ctx.lineWidth = 1.2;
  const foreX = hullLen * 0.24;
  const mainX = -hullLen * 0.03;
  const mizzenX = -hullLen * 0.29;
  const foreTop = -shipH * 0.82;
  const mainTop = -shipH * 0.96;
  const mizzenTop = -shipH * 0.72;

  ctx.beginPath();
  ctx.moveTo(bowX + hullLen * 0.22, -hullDepth * 1.52);
  ctx.lineTo(foreX, foreTop * 0.94);
  ctx.lineTo(mainX, mainTop * 0.95);
  ctx.lineTo(mizzenX, mizzenTop * 0.94);
  ctx.lineTo(sternX, -hullDepth * 1.22);
  ctx.stroke();

  // Shrouds miring ke lambung
  ctx.strokeStyle = "rgba(38, 22, 12, 0.32)";
  ctx.lineWidth = 1;
  [
    [foreX, foreTop * 0.74, hullLen * 0.14],
    [mainX, mainTop * 0.78, -hullLen * 0.12],
    [mizzenX, mizzenTop * 0.75, -hullLen * 0.37],
  ].forEach(([mx, my, gx]) => {
    for (let s = 0; s < 3; s++) {
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(gx + s * hullLen * 0.035, -hullDepth * 0.65);
      ctx.stroke();
    }
  });

  // ── 3. Tiga Tiang Utama ──
  ctx.strokeStyle = "#2f190d";
  ctx.lineCap = "round";
  const drawMast = (x: number, topY: number, baseW: number) => {
    ctx.lineWidth = baseW;
    ctx.beginPath();
    ctx.moveTo(x, -hullDepth * 0.4);
    ctx.lineTo(x, topY);
    ctx.stroke();
    // Crow's nest
    ctx.fillStyle = "#5b3219";
    ctx.fillRect(x - baseW * 2.1, topY * 0.73, baseW * 4.2, baseW * 0.9);
  };
  drawMast(mizzenX, mizzenTop, shipH * 0.011);
  drawMast(mainX, mainTop, shipH * 0.015);
  drawMast(foreX, foreTop, shipH * 0.012);

  // ── 4. Layar-layar Mengembang ──
  // Mizzenmast (buritan): spanker miring + topsail
  ctx.fillStyle = "#f2ddc0";
  ctx.strokeStyle = "rgba(120, 74, 42, 0.32)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(mizzenX, -shipH * 0.46);
  ctx.lineTo(sternX - hullLen * 0.04, -shipH * 0.56);
  ctx.quadraticCurveTo(sternX + hullLen * 0.08, -shipH * 0.38, sternX - hullLen * 0.02, -hullDepth * 1.25);
  ctx.lineTo(mizzenX, -hullDepth * 0.96);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawSquareSail(ctx, mizzenX, -shipH * 0.68, hullLen * 0.17, shipH * 0.19, shipH * 0.055, time * 5.2 + 1);

  // Mainmast (tengah paling tinggi)
  drawSquareSail(ctx, mainX, -shipH * 0.49, hullLen * 0.33, shipH * 0.28, shipH * 0.09, time * 4.8, true);
  drawSquareSail(ctx, mainX, -shipH * 0.74, hullLen * 0.25, shipH * 0.22, shipH * 0.07, time * 5.1 + 0.7);
  drawSquareSail(ctx, mainX, -shipH * 0.92, hullLen * 0.16, shipH * 0.15, shipH * 0.045, time * 5.6 + 1.4);

  // Foremast (depan)
  drawSquareSail(ctx, foreX, -shipH * 0.46, hullLen * 0.26, shipH * 0.24, shipH * 0.075, time * 4.9 + 0.4);
  drawSquareSail(ctx, foreX, -shipH * 0.68, hullLen * 0.19, shipH * 0.18, shipH * 0.055, time * 5.4 + 1.1);

  // Bendera berkibar di 3 puncak tiang
  drawPennant(ctx, foreX, foreTop, shipH * 0.11, shipH * 0.024, time, "#d97706");
  drawPennant(ctx, mainX, mainTop, shipH * 0.16, shipH * 0.032, time + 0.8, "#b91c1c");
  drawPennant(ctx, mizzenX, mizzenTop, shipH * 0.1, shipH * 0.022, time + 1.5, "#f59e0b");

  // ── 5. Lambung Kapal Galleon + Sterncastle Tinggi ──
  const hullGrad = ctx.createLinearGradient(0, -hullDepth * 1.25, 0, hullDepth * 0.15);
  hullGrad.addColorStop(0, "#6c391d");
  hullGrad.addColorStop(0.45, "#472311");
  hullGrad.addColorStop(1, "#261108");

  ctx.beginPath();
  // Mulai dari haluan atas
  ctx.moveTo(bowX * 0.96, -hullDepth * 0.88);
  // Haluan melengkung ke lunas air
  ctx.quadraticCurveTo(bowX * 1.02, -hullDepth * 0.25, bowX * 0.74, hullDepth * 0.08);
  // Lunas bawah ke buritan
  ctx.lineTo(sternX * 0.78, hullDepth * 0.08);
  // Buritan naik bertingkat ke sterncastle
  ctx.lineTo(sternX * 1.02, -hullDepth * 1.28);
  ctx.lineTo(sternX * 0.48, -hullDepth * 1.22);
  ctx.lineTo(sternX * 0.34, -hullDepth * 0.95);
  ctx.lineTo(bowX * 0.54, -hullDepth * 0.78);
  ctx.quadraticCurveTo(bowX * 0.76, -hullDepth * 0.86, bowX * 0.96, -hullDepth * 0.88);
  ctx.closePath();

  ctx.fillStyle = hullGrad;
  ctx.fill();
  ctx.strokeStyle = "#1d0c05";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Garis lis kayu kuning-emas sepanjang lambung
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = Math.max(2, shipH * 0.008);
  ctx.beginPath();
  ctx.moveTo(sternX * 0.98, -hullDepth * 0.96);
  ctx.quadraticCurveTo(0, -hullDepth * 0.64, bowX * 0.91, -hullDepth * 0.76);
  ctx.stroke();

  ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
  ctx.lineWidth = Math.max(1.5, shipH * 0.005);
  ctx.beginPath();
  ctx.moveTo(sternX * 0.9, -hullDepth * 0.62);
  ctx.quadraticCurveTo(0, -hullDepth * 0.36, bowX * 0.85, -hullDepth * 0.46);
  ctx.stroke();

  // Lubang meriam / jendela kabin menyala hangat di sterncastle & lambung
  for (let i = 0; i < 6; i++) {
    const px = sternX * 0.45 + i * hullLen * 0.125;
    const py = -hullDepth * 0.42 + (i > 2 ? 2 : 0);
    ctx.fillStyle = "#fde68a";
    ctx.shadowColor = "rgba(251, 191, 36, 0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2.5, shipH * 0.009), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Jendela kabin kapten besar di buritan
  ctx.fillStyle = "rgba(254, 240, 138, 0.88)";
  for (let w = 0; w < 3; w++) {
    ctx.fillRect(
      sternX * 0.91 + w * hullLen * 0.042,
      -hullDepth * 1.12,
      hullLen * 0.028,
      hullDepth * 0.24
    );
  }

  // Lentera emas menggantung di buritan
  ctx.fillStyle = "#fbbf24";
  ctx.shadowColor = "rgba(251, 191, 36, 0.95)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(sternX * 1.04, -hullDepth * 1.36, Math.max(4, shipH * 0.012), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Figurehead emas di haluan
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(bowX * 0.96, -hullDepth * 0.86, Math.max(4, shipH * 0.013), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Overlay animasi kapal layar 2D Canvas sinematik yang berlayar memenuhi layar dari kiri ke kanan
 * sambil menyapu tirai laut (wipe reveal) untuk menyingkap dashboard di belakangnya.
 */
export function DashboardShipWipeOverlay({
  phase,
  onShipPassed,
}: DashboardShipWipeOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onPassedRef = useRef(onShipPassed);
  onPassedRef.current = onShipPassed;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || phase !== "sailing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let startTs = 0;
    let finished = false;
    const isMobile = window.innerWidth < 640;
    const durationMs = isMobile ? 1350 : 1650;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const particles: SprayParticle[] = [];

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (ts: number) => {
      if (!startTs) startTs = ts;
      const elapsedMs = ts - startTs;
      const tSec = elapsedMs / 1000;
      const rawP = Math.min(1, elapsedMs / durationMs);
      const easeP = easeInOutSine(rawP);

      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Tinggi kapal mengisi hampir seluruh layar vertikal (memenuhi layar!)
      const shipH = isMobile ? Math.min(h * 0.72, w * 1.18) : Math.min(h * 0.84, w * 0.56);
      const hullLen = shipH * 1.12;
      const waterlineY = h * (isMobile ? 0.8 : 0.83);

      // Lintasan horizontal dari luar kiri (-hullLen*0.8) menuju luar kanan (w + hullLen*0.85)
      const startX = -hullLen * 0.78;
      const endX = w + hullLen * 0.88;
      const shipX = startX + (endX - startX) * easeP;

      // Tepi tirai yang disapu kapal tepat di belakang garis haluan/tiang utama
      const wipeEdgeX = Math.max(0, Math.min(w + 80, shipX - hullLen * 0.05));

      // ── 1. Tirai Laut & Senja pada bagian kanan layar yang belum dilewati kapal ──
      if (wipeEdgeX < w + 60) {
        ctx.save();
        ctx.beginPath();
        // Tepi tirai dibuat sedikit berlekuk ombak mengikuti sapuan kapal
        ctx.moveTo(w + 60, 0);
        ctx.lineTo(w + 60, h);
        ctx.lineTo(Math.max(0, wipeEdgeX - 42), h);
        for (let y = h; y >= 0; y -= 24) {
          const waveIndent = Math.sin(y * 0.025 - tSec * 7) * 16;
          const xEdge = wipeEdgeX + waveIndent - ((h - y) / h) * 18;
          ctx.lineTo(xEdge, y);
        }
        ctx.closePath();
        ctx.clip();

        // Gradasi langit-senja menuju laut biru tua (menyambung warna akhir SunsetSailTransition)
        const skyCurtain = ctx.createLinearGradient(0, 0, 0, h);
        skyCurtain.addColorStop(0, "#14192e");
        skyCurtain.addColorStop(0.45, "#232542");
        skyCurtain.addColorStop(0.78, "#6a3a45");
        skyCurtain.addColorStop(1, "#0b243b");
        ctx.fillStyle = skyCurtain;
        ctx.fillRect(0, 0, w + 60, h);

        // Kilau cakrawala halus di tirai kanan
        const horizonGlow = ctx.createRadialGradient(
          Math.max(wipeEdgeX, w * 0.55),
          waterlineY - shipH * 0.18,
          10,
          Math.max(wipeEdgeX, w * 0.55),
          waterlineY - shipH * 0.18,
          Math.max(w, h) * 0.55
        );
        horizonGlow.addColorStop(0, "rgba(255, 204, 138, 0.34)");
        horizonGlow.addColorStop(0.5, "rgba(220, 120, 92, 0.14)");
        horizonGlow.addColorStop(1, "rgba(10, 20, 38, 0)");
        ctx.fillStyle = horizonGlow;
        ctx.fillRect(0, 0, w + 60, h);
        ctx.restore();
      }

      // Garis kabut / buih air vertikal lembut di perbatasan tirai yang baru saja tersingkap
      if (rawP > 0.02 && rawP < 0.97) {
        const edgeMist = ctx.createLinearGradient(wipeEdgeX - 55, 0, wipeEdgeX + 35, 0);
        edgeMist.addColorStop(0, "rgba(255, 240, 214, 0)");
        edgeMist.addColorStop(0.55, "rgba(255, 232, 198, 0.24)");
        edgeMist.addColorStop(1, "rgba(19, 44, 72, 0)");
        ctx.fillStyle = edgeMist;
        ctx.fillRect(wipeEdgeX - 55, 0, 90, h);
      }

      // ── 2. Gelombang Laut Belakang di sekitar lambung ──
      const drawSeaWaveBand = (
        baseY: number,
        amp: number,
        freq: number,
        speed: number,
        fillStyle: string | CanvasGradient,
        alpha = 1
      ) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        // Muncul memudar di belakang kapal dan menutupi tirai kanan hingga selesai
        const leftBound = Math.max(0, shipX - hullLen * 0.95);
        ctx.moveTo(leftBound, h);
        for (let x = leftBound; x <= w + 24; x += 22) {
          const y = baseY + Math.sin(x * freq - tSec * speed) * amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w + 24, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const seaFade = rawP < 0.12 ? rawP / 0.12 : rawP > 0.85 ? (1 - rawP) / 0.15 : 1;
      drawSeaWaveBand(
        waterlineY - 8,
        10,
        0.012,
        5.5,
        "#0c2a45",
        0.82 * Math.max(0, seaFade)
      );

      // ── 3. Render Kapal Galleon dengan gerakan pitch & heave ombak ──
      const bobY = Math.sin(tSec * 5.2) * (shipH * 0.012);
      const pitch = Math.sin(tSec * 4.4) * 0.028 - 0.012;

      ctx.save();
      ctx.translate(shipX, waterlineY + bobY);
      ctx.rotate(pitch);
      drawFullGalleon(ctx, shipH, tSec);
      ctx.restore();

      // ── 4. Partikel Buih Air Haluan & Jejak Buritan ──
      if (rawP < 0.92) {
        const bowSprayX = shipX + hullLen * 0.44;
        const sternFoamX = shipX - hullLen * 0.45;
        for (let k = 0; k < 3; k++) {
          particles.push({
            x: bowSprayX + (Math.random() - 0.5) * 26,
            y: waterlineY + bobY - Math.random() * 12,
            vx: -1.5 - Math.random() * 3.5,
            vy: -2.2 - Math.random() * 4.2,
            r: 2 + Math.random() * 4.5,
            alpha: 0.75,
            life: 0,
            maxLife: 24 + Math.random() * 20,
          });
        }
        particles.push({
          x: sternFoamX + (Math.random() - 0.5) * 18,
          y: waterlineY + bobY + Math.random() * 10,
          vx: -2.2 - Math.random() * 2.5,
          vy: (Math.random() - 0.5) * 1.2,
          r: 3 + Math.random() * 5.5,
          alpha: 0.52,
          life: 0,
          maxLife: 28 + Math.random() * 18,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life += 1;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.16;
        const ratio = 1 - pt.life / pt.maxLife;
        if (ratio <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(240, 249, 255, ${(pt.alpha * ratio).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.6 + 0.5 * ratio), 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 5. Gelombang Ombak Depan (menutup bagian dasar lunas kapal secara alami) ──
      const frontSeaGrad = ctx.createLinearGradient(0, waterlineY - 12, 0, h);
      frontSeaGrad.addColorStop(0, "rgba(18, 62, 94, 0.92)");
      frontSeaGrad.addColorStop(0.22, "rgba(11, 39, 66, 0.96)");
      frontSeaGrad.addColorStop(1, "rgba(7, 22, 42, 0.98)");
      drawSeaWaveBand(
        waterlineY + 8,
        13,
        0.015,
        7.2,
        frontSeaGrad,
        Math.max(0, seaFade)
      );

      ctx.restore();

      if (rawP >= 1 && !finished) {
        finished = true;
        onPassedRef.current();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [mounted, phase]);

  if (!mounted) return null;

  const content = (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-screen h-[100dvh] z-[999990] pointer-events-none overflow-hidden select-none"
    >
      {phase === "curtain" ? (
        <div
          className="w-full h-full"
          style={{
            background:
              "linear-gradient(180deg, #14192e 0%, #232542 45%, #6a3a45 78%, #0b243b 100%)",
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="w-full h-full block" />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

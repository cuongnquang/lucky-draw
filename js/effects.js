/* ============================================================
   effects.js — confetti + particle canvas
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let particles = [];
  let raf = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const GOLD = ["#ffd166", "#ff9f1c", "#ff7a1a", "#fff3c4", "#ffffff"];
  const RAINBOW = ["#ffd166", "#ff9f1c", "#8b5cf6", "#2ce0ff", "#2fe6a0", "#ff6b6b", "#ffffff"];

  function themeAccent() {
    const cs = getComputedStyle(document.body);
    const accent = cs.getPropertyValue("--accent").trim() || "#ffd166";
    const strong = cs.getPropertyValue("--accent-strong").trim() || "#ff9f1c";
    return [accent, strong, "#ffffff", "#8b5cf6", "#2ce0ff"];
  }

  function spawnBurst(x, y, count, power, palette) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.22 + Math.random() * 0.65) * power;
      particles.push({
        kind: Math.random() < 0.72 ? "confetti" : "spark",
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - power * 0.35,
        size: 5 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        color: palette[(Math.random() * palette.length) | 0],
        life: 1, decay: 0.008 + Math.random() * 0.012,
        sway: Math.random() * Math.PI * 2,
        sq: 1 + Math.random() * 8,
        glow: Math.random() < 0.25,
      });
    }
  }

  function spawnRain(durationMs, palette) {
    const n = Math.min(220, Math.round(W / 5));
    for (let i = 0; i < n; i++) {
      particles.push({
        kind: "confetti",
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.4,
        vx: (Math.random() - 0.5) * 0.7,
        vy: 1.4 + Math.random() * 1.8,
        size: 5 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: palette[(Math.random() * palette.length) | 0],
        life: 1,
        decay: 0.004,
        sway: Math.random() * Math.PI * 2,
        sq: 1 + Math.random() * 8,
        rain: true,
      });
    }
    if (durationMs > 0) {
      setTimeout(() => {
        for (const p of particles) if (p.rain) p.decay = 0.03;
      }, durationMs);
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    const next = [];
    for (const p of particles) {
      p.life -= p.decay;
      if (p.life <= 0) continue;
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * (p.kind === "confetti" ? 1.1 : 0.4);
      p.y += p.vy;
      if (p.kind === "confetti") p.vy += 0.045; else p.vy += 0.02;
      if (p.y > H + 30) continue;
      p.rot += p.vr;
      const alpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.globalAlpha = alpha;
      if (p.kind === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 12; }
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.4 * alpha), 0, Math.PI * 2);
        ctx.fill();
        if (p.glow) {
          ctx.globalAlpha = alpha * 0.35;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.9 + Math.sin(p.sway) * 0.3), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      next.push(p);
    }
    particles = next;
    if (particles.length) raf = requestAnimationFrame(loop);
    else { raf = null; ctx.clearRect(0, 0, W, H); }
  }
  function ensureLoop() { if (!raf) raf = requestAnimationFrame(loop); }

  function burstAt(x, y, count = 90, power = 1.15) {
    if (count <= 0) return;
    spawnBurst(x || W / 2, y || H * 0.35, count, power, themeAccent());
    ensureLoop();
  }
  function celebrate(x, y) {
    spawnBurst(x || W / 2, y || H * 0.4, 130, 1.3, RAINBOW);
    spawnBurst(x || W / 2, y || H * 0.3, 60, 0.9, GOLD);
    spawnRain(2600, RAINBOW);
    ensureLoop();
  }
  function confettiRain(duration = 2600) {
    spawnRain(duration, RAINBOW);
    ensureLoop();
  }
  function sparks(x, y, count = 26, palette) {
    spawnBurst(x || W / 2, y || H / 2, count, 0.8, palette || GOLD);
    ensureLoop();
  }
  function clear() { particles = []; if (raf) { cancelAnimationFrame(raf); raf = null; } ctx.clearRect(0, 0, W, H); }

  window.LD = Object.assign(window.LD || {}, { fx: { celebrate, burstAt, confettiRain, sparks, clear, themeAccent } });
})();
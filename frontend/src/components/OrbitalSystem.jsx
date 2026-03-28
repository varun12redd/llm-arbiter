import { useEffect, useRef } from "react";

/*
  CHIP NETWORK — Pure Canvas 2D
  Chips sized relative to HEIGHT so they fill the canvas properly.
  Pulse rings only on state transitions, not continuous.
  Energy sweeps replace bouncing dots.
*/

const FONT = "'JetBrains Mono','Fira Code','Courier New',monospace";

const AMBER = "#F59E0B";
const PCOLORS = ["#38BDF8", "#A78BFA", "#34D399", "#FB7185"];
const pc = (i) => PCOLORS[i % PCOLORS.length];

function hexRgb(h) {
  return `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
}

/* ── LAYOUT — sized to HEIGHT so chips are always big ── */
function getLayout(W, H, n) {
  const cx = W / 2,
    cy = H / 2;
  const rx = W * 0.34;
  const ry = H * 0.34;
  const chips = [{ x: cx, y: cy, isCenter: true }];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    chips.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return chips;
}

/* Chip dims based on HEIGHT */
function chipSize(H, isCenter) {
  if (isCenter) return { w: H * 0.28, h: H * 0.2 };
  return { w: H * 0.23, h: H * 0.17 };
}

/* ── PCB TRACE ── */
function tracePts(x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = x1 + dx * 0.5;
    return [
      { x: x1, y: y1 },
      { x: mx, y: y1 },
      { x: mx, y: y2 },
      { x: x2, y: y2 },
    ];
  }
  const my = y1 + dy * 0.5;
  return [
    { x: x1, y: y1 },
    { x: x1, y: my },
    { x: x2, y: my },
    { x: x2, y: y2 },
  ];
}

function pathLen(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

function ptAt(pts, prog) {
  const total = pathLen(pts);
  const tgt = total * Math.max(0, Math.min(1, prog));
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + seg >= tgt) {
      const t = seg > 0 ? (tgt - acc) / seg : 0;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

/* ── DRAW ── */

function drawGrid(ctx, W, H) {
  const step = 36;
  ctx.save();
  ctx.strokeStyle = "rgba(148,163,184,0.04)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(148,163,184,0.07)";
  for (let x = 0; x < W; x += step)
    for (let y = 0; y < H; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  ctx.restore();
}

function drawTrace(ctx, pts, col, alpha, active) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = active ? 1.8 : 1.0;
  ctx.globalAlpha = alpha;
  if (active) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = col;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // bend dots
  ctx.fillStyle = col;
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.beginPath();
    ctx.arc(pts[i].x, pts[i].y, active ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSweep(ctx, pts, prog, col) {
  if (prog <= 0 || prog >= 1) return;
  const head = ptAt(pts, prog);
  const tail = ptAt(pts, Math.max(0, prog - 0.14));
  ctx.save();
  const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  grad.addColorStop(0, `rgba(${hexRgb(col)},0)`);
  grad.addColorStop(1, `rgba(${hexRgb(col)},0.9)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.8;
  ctx.shadowBlur = 16;
  ctx.shadowColor = col;
  // sample points for the tail
  const steps = 16;
  ctx.beginPath();
  ctx.moveTo(tail.x, tail.y);
  for (let s = 1; s <= steps; s++) {
    const p = ptAt(pts, Math.max(0, prog - 0.14 + (0.14 / steps) * s));
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawChip(ctx, x, y, w, h, col, glow, t, label, sub, isWinner) {
  const r = 8;
  ctx.save();

  // glow halo
  if (glow > 0.05) {
    for (let g = 5; g >= 1; g--) {
      ctx.globalAlpha = (glow * 0.12) / g;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(
        x - w / 2 - g * 7,
        y - h / 2 - g * 7,
        w + g * 14,
        h + g * 14,
        r + g * 3,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // body gradient
  const bg = ctx.createLinearGradient(
    x - w / 2,
    y - h / 2,
    x + w / 2,
    y + h / 2,
  );
  const t0 = 0.07 + glow * 0.18,
    t1 = 0.03 + glow * 0.1;
  bg.addColorStop(0, `rgba(${hexRgb(col)},${t0})`);
  bg.addColorStop(0.45, `rgba(6,10,20,0.96)`);
  bg.addColorStop(1, `rgba(${hexRgb(col)},${t1})`);
  ctx.fillStyle = bg;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
  ctx.fill();

  // border
  ctx.strokeStyle = col;
  ctx.lineWidth = isWinner ? 2.2 : 1.4;
  ctx.globalAlpha = 0.28 + glow * 0.72;
  if (glow > 0.4) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = col;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // IC notch + circle
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4 + glow * 0.5;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 13, y - h / 2);
  ctx.lineTo(x - w / 2, y - h / 2 + 13);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - w / 2 + 7, y - h / 2 + 7, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // pins — top & bottom for visual variety
  const pinN = 5,
    pinLen = Math.round(h * 0.12),
    pinGap = (w - 20) / (pinN - 1);
  for (let p = 0; p < pinN; p++) {
    const px = x - w / 2 + 10 + p * pinGap;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.18 + glow * 0.44;
    ctx.beginPath();
    ctx.moveTo(px, y - h / 2);
    ctx.lineTo(px, y - h / 2 - pinLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, y + h / 2);
    ctx.lineTo(px, y + h / 2 + pinLen);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.22 + glow * 0.32;
    ctx.fillRect(px - 2, y - h / 2 - pinLen - 3, 4, 3);
    ctx.fillRect(px - 2, y + h / 2 + pinLen, 4, 3);
  }
  ctx.globalAlpha = 1;

  // scan line inside chip
  if (glow > 0.35) {
    const sy = y - h / 2 + 2 + ((t * 44) % (h - 4));
    const sg = ctx.createLinearGradient(x - w / 2, sy, x + w / 2, sy + 4);
    sg.addColorStop(0, `rgba(${hexRgb(col)},0)`);
    sg.addColorStop(0.5, `rgba(${hexRgb(col)},${glow * 0.2})`);
    sg.addColorStop(1, `rgba(${hexRgb(col)},0)`);
    ctx.fillStyle = sg;
    ctx.globalAlpha = 1;
    ctx.fillRect(x - w / 2 + 3, sy, w - 6, 4);
  }

  // text — always visible with shadow backing
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  const labelAlpha = 0.65 + glow * 0.35;
  ctx.fillStyle = `rgba(${hexRgb(col)},${labelAlpha})`;
  ctx.font = `800 ${Math.round(h * 0.21)}px ${FONT}`;
  ctx.fillText(label, x, sub ? y - h * 0.14 : y);
  if (sub) {
    ctx.font = `500 ${Math.round(h * 0.15)}px ${FONT}`;
    ctx.fillStyle = `rgba(${hexRgb(col)},${0.45 + glow * 0.4})`;
    ctx.shadowBlur = 4;
    ctx.fillText(sub, x, y + h * 0.18);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ── MAIN ── */
export default function ChipNetwork({
  providers = [],
  activeIndex,
  winner,
  phase,
}) {
  const canvasRef = useRef(null);
  const stRef = useRef({
    t: 0,
    centerGlow: 0,
    chipGlow: [],
    traceAlpha: [],
    sweeps: [],
    rings: [], // { x,y,r,alpha,col,speed }
    lastPhase: "idle",
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      c.width = c.offsetWidth * devicePixelRatio;
      c.height = c.offsetHeight * devicePixelRatio;
    });
    ro.observe(c);
    c.width = c.offsetWidth * devicePixelRatio;
    c.height = c.offsetHeight * devicePixelRatio;
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf,
      last = performance.now();
    const s = stRef.current;
    s.sweeps = [];
    s.rings = [];

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      s.t += dt;
      const ctx = canvas.getContext("2d");
      const W = canvas.offsetWidth,
        H = canvas.offsetHeight,
        DPR = devicePixelRatio;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const n = providers.length;
      const lay = getLayout(W, H, n);
      const ctr = lay[0];
      const { w: CW, h: CH } = chipSize(H, true);
      const { w: PW, h: PH } = chipSize(H, false);

      // BACKGROUND
      drawGrid(ctx, W, H);

      // GLOW LERP
      const cTgt = phase === "idle" ? 0.15 : 1.0;
      s.centerGlow += (cTgt - s.centerGlow) * Math.min(dt * 2.5, 1);
      while (s.chipGlow.length < n) s.chipGlow.push(0);
      while (s.traceAlpha.length < n) s.traceAlpha.push(0);
      for (let i = 0; i < n; i++) {
        const online = i <= activeIndex || phase === "complete";
        const win = providers[i]?.provider === winner?.provider;
        s.chipGlow[i] +=
          ((win ? 1.0 : online ? 0.72 : 0.0) - s.chipGlow[i]) *
          Math.min(dt * 2.8, 1);
        s.traceAlpha[i] +=
          ((online ? (win ? 0.9 : 0.55) : 0.0) - s.traceAlpha[i]) *
          Math.min(dt * 2.2, 1);
      }

      // SPAWN SWEEPS — one sweep per active provider per interval (not every frame)
      const sweepInterval = phase === "complete" ? 0.7 : 0.5;
      if (phase !== "idle" && s.t % sweepInterval < dt + 0.008) {
        const lim = phase === "loading" ? n : Math.min(activeIndex + 1, n);
        for (let i = 0; i < lim; i++) {
          s.sweeps.push({
            index: i,
            progress: 0,
            dir: 0,
            speed: 0.65 + Math.random() * 0.25,
          });
          if (phase === "revealing" || phase === "complete")
            s.sweeps.push({
              index: i,
              progress: 0.05,
              dir: 1,
              speed: 0.6 + Math.random() * 0.25,
            });
        }
      }
      s.sweeps = s.sweeps.filter((sw) => {
        sw.progress += dt * sw.speed;
        return sw.progress < 1;
      });

      // PHASE TRANSITION RINGS (only once per transition)
      if (phase !== s.lastPhase) {
        if (phase === "loading" || phase === "complete") {
          for (let k = 0; k < 3; k++)
            s.rings.push({
              x: ctr.x,
              y: ctr.y,
              r: CW * 0.4 + k * CW * 0.15,
              alpha: 0.7,
              col: AMBER,
              speed: 65,
            });
        }
        if (phase === "complete") {
          const wi = providers.findIndex(
            (p) => p.provider === winner?.provider,
          );
          if (wi >= 0 && wi + 1 < lay.length) {
            const wp = lay[wi + 1];
            for (let k = 0; k < 3; k++)
              s.rings.push({
                x: wp.x,
                y: wp.y,
                r: PW * 0.35 + k * PW * 0.12,
                alpha: 0.8,
                col: pc(wi),
                speed: 55,
              });
          }
        }
        s.lastPhase = phase;
      }
      // advance rings
      s.rings = s.rings.filter((ring) => {
        ring.r += dt * ring.speed;
        ring.alpha -= dt * 0.55;
        if (ring.alpha <= 0) return false;
        ctx.save();
        ctx.strokeStyle = ring.col;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = ring.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ring.col;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
        return true;
      });

      // TRACES
      for (let i = 0; i < n; i++) {
        if (i + 1 >= lay.length) continue;
        const prov = lay[i + 1];
        const pts = tracePts(ctr.x, ctr.y, prov.x, prov.y);
        const alp = 0.12 + s.traceAlpha[i] * 0.6;
        drawTrace(ctx, pts, pc(i), alp, s.traceAlpha[i] > 0.2);
      }

      // SWEEPS
      for (const sw of s.sweeps) {
        if (sw.index + 1 >= lay.length) continue;
        const prov = lay[sw.index + 1];
        const pts = tracePts(ctr.x, ctr.y, prov.x, prov.y);
        const fwd = sw.dir === 0 ? pts : [...pts].reverse();
        drawSweep(ctx, fwd, sw.progress, pc(sw.index));
      }

      // PROVIDER CHIPS
      for (let i = 0; i < n; i++) {
        if (i + 1 >= lay.length) continue;
        const pos = lay[i + 1];
        const isWin = providers[i]?.provider === winner?.provider;
        const errored = providers[i]?.status === "error";
        const label =
          providers[i]?.provider?.replace("Provider", "").toUpperCase() ??
          `NODE${i}`;
        const lat = providers[i]?.latency;
        const sub = isWin
          ? "★ WINNER"
          : lat != null
            ? `${lat.toFixed(2)}s`
            : errored
              ? "ERROR"
              : null;
        drawChip(
          ctx,
          pos.x,
          pos.y,
          PW,
          PH,
          errored ? "#64748B" : pc(i),
          errored ? s.chipGlow[i] * 0.25 : s.chipGlow[i],
          s.t,
          label,
          sub,
          isWin,
        );
      }

      // CENTER
      const centerSub =
        phase === "complete"
          ? "CONSENSUS"
          : phase === "loading"
            ? "PROCESSING"
            : phase === "revealing"
              ? "ANALYZING"
              : "STANDBY";
      drawChip(
        ctx,
        ctr.x,
        ctr.y,
        CW,
        CH,
        AMBER,
        s.centerGlow,
        s.t,
        "LLM ARBITER",
        centerSub,
        phase === "complete",
      );

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [providers, activeIndex, winner, phase]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

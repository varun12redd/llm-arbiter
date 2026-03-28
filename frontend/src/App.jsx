import { useState, useEffect, useRef } from "react";
import ChipNetwork from "./components/OrbitalSystem";
import { askLLM } from "./api/api";
import { transformResponse } from "./utils/transform";

/* ══════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════ */
const FONT = "'JetBrains Mono','Fira Code','Courier New',monospace";
const BG = "#03060F"; // near-black navy
const SURFACE = "#080D1A"; // panel bg
const BORDER = "rgba(255,255,255,0.07)";
const AMBER = "#F59E0B"; // center / accent
const SKY = "#38BDF8"; // provider 0
const VIOLET = "#A78BFA"; // provider 1
const EMERALD = "#34D399"; // provider 2 / winner / green
const ROSE = "#FB7185"; // provider 3
const TEXT = "#94A3B8"; // body text — visible
const TEXT2 = "#64748B"; // secondary text — visible
const TEXT3 = "#475569"; // tertiary — still readable
const HEAD = "#CBD5E1"; // heading text

const PCOLORS = [SKY, VIOLET, EMERALD, ROSE];
const pc = (i) => PCOLORS[i % PCOLORS.length];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const MODES = [
  { id: "analysis", label: "ANALYSIS", desc: "All providers · full compare" },
  { id: "parallel", label: "PARALLEL", desc: "Fast consensus · early exit" },
  { id: "sequential", label: "SEQUENTIAL", desc: "One by one · ordered" },
];

/* ── TYPEWRITER ── */
function useTypewriter(text, speed = 13) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!text) {
      setOut("");
      return;
    }
    setOut("");
    let i = 0;
    const iv = setInterval(() => {
      setOut(text.slice(0, ++i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text]);
  return out;
}

/* ── STYLE UTILS ── */
const f = (sz, extra = {}) => ({
  fontFamily: FONT,
  fontSize: `${sz}px`,
  ...extra,
});
const R = (extra = {}) => ({ display: "flex", alignItems: "center", ...extra });
const C = (extra = {}) => ({
  display: "flex",
  flexDirection: "column",
  ...extra,
});

/* ── SECTION HEADER ── */
function SH({ children, color = AMBER }) {
  return (
    <div
      style={{
        ...f(9),
        color,
        letterSpacing: "3px",
        fontWeight: 700,
        borderBottom: `1px solid rgba(${color === "amber" ? "245,158,11" : "255,255,255"},0.1)`,
        paddingBottom: 6,
        marginBottom: 10,
        borderColor: `${color}22`,
      }}
    >
      {children}
    </div>
  );
}

/* ── CONFIDENCE BAR ── */
function ConfBar({ conf }) {
  if (!conf) return null;
  const pct =
    { very_high: 97, high: 80, moderate: 58, low: 32, none: 0 }[
      conf.certainty_level
    ] ?? 50;
  const c = pct >= 80 ? EMERALD : pct >= 58 ? AMBER : ROSE;
  return (
    <div style={C({ gap: 8 })}>
      <div style={R({ justifyContent: "space-between" })}>
        <span style={f(10, { color: TEXT2 })}>CONFIDENCE</span>
        <span style={f(11, { color: c, fontWeight: 700 })}>
          {conf.certainty_level?.toUpperCase()}
        </span>
      </div>
      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg,${c}88,${c})`,
            transition: "width 1.4s cubic-bezier(.22,1,.36,1)",
            boxShadow: `0 0 10px ${c}`,
          }}
        />
      </div>
      <div style={R({ gap: 14, flexWrap: "wrap" })}>
        {[
          ["AGREED", `${conf.providers_agreed}/${conf.providers_considered}`],
          ["SIMILAR", `${((conf.similarity_score ?? 0) * 100).toFixed(0)}%`],
          ["NUMERIC", conf.numeric_consistent ? "YES" : "NO"],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={f(9, { color: TEXT3, letterSpacing: "1px" })}>{k}</div>
            <div style={f(12, { color: c, fontWeight: 700, marginTop: 2 })}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── SYSTEM LOG ── */
function SysLog({ lines }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={ref}
      style={{
        background: "rgba(255,255,255,0.025)",
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        padding: "8px 10px",
        maxHeight: 130,
        overflowY: "auto",
        ...C({ gap: 3 }),
      }}
    >
      {lines.map((l, i, arr) => (
        <div
          key={i}
          style={R({ gap: 6, opacity: 0.35 + (i / arr.length) * 0.65 })}
        >
          <span
            style={{
              color: AMBER,
              fontSize: "11px",
              flexShrink: 0,
              fontFamily: FONT,
            }}
          >
            ›
          </span>
          <span style={f(10, { color: TEXT2, lineHeight: 1.55 })}>{l}</span>
        </div>
      ))}
    </div>
  );
}

/* ── MODE BUTTON ── */
function ModeBtn({ label, desc, active, disabled, onClick }) {
  const [h, setH] = useState(false);
  const lit = active || h;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...C({
          alignItems: "flex-start",
          padding: "8px 11px",
          width: "100%",
          gap: 3,
        }),
        background: active
          ? `${AMBER}10`
          : h
            ? `rgba(245,158,11,0.05)`
            : "transparent",
        border: `1px solid ${active ? `${AMBER}55` : h ? `${AMBER}22` : BORDER}`,
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.18s",
        boxShadow: active ? `0 0 14px ${AMBER}18` : "none",
      }}
    >
      <div style={R({ gap: 7 })}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: active ? AMBER : "transparent",
            border: `1.5px solid ${active ? AMBER : TEXT3}`,
            boxShadow: active ? `0 0 8px ${AMBER}` : "none",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        />
        <span
          style={f(10, {
            color: active ? AMBER : TEXT2,
            letterSpacing: "2px",
            fontWeight: active ? 700 : 400,
          })}
        >
          {label}
        </span>
      </div>
      <span style={f(9, { color: TEXT3, marginLeft: 13 })}>{desc}</span>
    </button>
  );
}

/* ── METRIC TILE ── */
function Tile({ label, value, c = TEXT2 }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        padding: "9px 11px",
      }}
    >
      <div style={f(9, { color: TEXT3, letterSpacing: "1.5px" })}>{label}</div>
      <div style={f(14, { color: c, fontWeight: 700, marginTop: 3 })}>
        {value || "—"}
      </div>
    </div>
  );
}

/* ── PROVIDER STATUS ROW (animated) ── */
function PRow({ p, index, activeIndex, phase, isWinner, animDelay = 0 }) {
  const [visible, setVisible] = useState(false);
  const lit = index <= activeIndex || phase === "complete";
  const c = pc(index);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  return (
    <div
      style={{
        ...R({ gap: 8, padding: "7px 0", borderBottom: `1px solid ${BORDER}` }),
        opacity: lit ? 1 : 0.25,
        transition: "opacity 0.6s ease",
        animation: visible ? "slideIn 0.35s ease both" : "none",
        animationDelay: `${animDelay}ms`,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: lit ? c : "rgba(255,255,255,0.08)",
          boxShadow: lit ? `0 0 8px ${c}` : "none",
          flexShrink: 0,
          transition: "all 0.5s",
        }}
      />
      <span
        style={f(11, {
          color: lit ? HEAD : TEXT3,
          flex: 1,
          transition: "color 0.4s",
        })}
      >
        {p.provider?.replace("Provider", "").toUpperCase()}
      </span>
      {isWinner && <span style={f(10, { color: c, fontWeight: 700 })}>★</span>}
      <span style={f(10, { color: TEXT2 })}>{p.latency?.toFixed(2)}s</span>
    </div>
  );
}

/* ── PROVIDER CARD (animated entry) ── */
function Card({ p, index, isWinner, onView, animDelay = 0 }) {
  const [h, setH] = useState(false);
  const [vis, setVis] = useState(false);
  const c = pc(index);
  const tag = p.latency < 2 ? "FAST" : p.latency > 5 ? "DEEP" : "BALANCED";

  useEffect(() => {
    const t = setTimeout(() => setVis(true), animDelay);
    return () => clearTimeout(t);
  }, [animDelay]);

  return (
    <div
      style={{
        background: isWinner ? `${c}0d` : SURFACE,
        border: `1px solid ${h || isWinner ? c + "55" : BORDER}`,
        borderRadius: 10,
        padding: "15px 16px",
        position: "relative",
        cursor: "default",
        transition: "all 0.22s",
        boxShadow: isWinner
          ? `0 0 24px ${c}18`
          : h
            ? `0 0 12px ${c}10`
            : "none",
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(12px)",
        animation: vis ? `cardIn 0.4s ease both` : "none",
        animationDelay: `${animDelay}ms`,
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {isWinner && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 14,
            background: c,
            color: "#000",
            fontFamily: FONT,
            fontSize: "8px",
            letterSpacing: "2px",
            padding: "2px 9px",
            borderRadius: 3,
            fontWeight: 900,
          }}
        >
          ★ WINNER
        </div>
      )}
      {/* top row */}
      <div style={R({ justifyContent: "space-between", marginBottom: 10 })}>
        <span style={f(12, { color: c, fontWeight: 800 })}>
          {p.provider?.replace("Provider", "").toUpperCase()}
        </span>
        <span style={f(9, { color: c, opacity: 0.7, letterSpacing: "1px" })}>
          ◆ {tag}
        </span>
      </div>
      {/* stats */}
      <div style={R({ gap: 18, marginBottom: 13 })}>
        <div>
          <div style={f(9, { color: TEXT3, letterSpacing: "1px" })}>
            LATENCY
          </div>
          <div style={f(12, { color: c, fontWeight: 600, marginTop: 2 })}>
            {p.latency?.toFixed(3)}s
          </div>
        </div>
        <div>
          <div style={f(9, { color: TEXT3, letterSpacing: "1px" })}>STATUS</div>
          <div
            style={f(12, {
              color: p.status === "ok" ? EMERALD : ROSE,
              fontWeight: 600,
              marginTop: 2,
            })}
          >
            {p.status?.toUpperCase()}
          </div>
        </div>
        <div>
          <div style={f(9, { color: TEXT3, letterSpacing: "1px" })}>MODEL</div>
          <div style={f(11, { color: TEXT2, marginTop: 2 })}>
            {p.provider?.replace("Provider", "")}
          </div>
        </div>
      </div>
      <button
        style={{
          width: "100%",
          padding: "8px 0",
          background: h ? `${c}18` : `${c}0c`,
          border: `1px solid ${c}44`,
          borderRadius: 5,
          color: c,
          fontFamily: FONT,
          fontSize: "10px",
          letterSpacing: "2.5px",
          cursor: "pointer",
          transition: "all 0.18s",
        }}
        onClick={() => onView(p, index)}
      >
        VIEW RESPONSE →
      </button>
    </div>
  );
}

/* ── RESPONSE MODAL ── */
function Modal({ card, idx, onClose }) {
  const typed = useTypewriter(card?.output ?? "", 11);
  if (!card) return null;
  const c = pc(idx ?? 0);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,8,0.92)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backdropFilter: "blur(16px)",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(760px,93vw)",
          maxHeight: "80vh",
          background: "#050912",
          border: `1px solid ${c}44`,
          borderRadius: 12,
          ...C({ overflow: "hidden" }),
          boxShadow: `0 0 80px ${c}18, 0 40px 80px rgba(0,0,0,0.9)`,
          animation: "scaleIn 0.25s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div
          style={{
            ...R({ justifyContent: "space-between", padding: "14px 20px" }),
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={R({ gap: 10 })}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: c,
                boxShadow: `0 0 12px ${c}`,
              }}
            />
            <span
              style={f(13, {
                color: c,
                letterSpacing: "2.5px",
                fontWeight: 600,
              })}
            >
              {card.provider?.replace("Provider", "").toUpperCase()} — RESPONSE
            </span>
          </div>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: TEXT2,
              fontSize: "16px",
              cursor: "pointer",
              fontFamily: FONT,
              transition: "color 0.2s",
              padding: "2px 6px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = HEAD)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT2)}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {/* scan line */}
        <div
          style={{
            height: "1.5px",
            background: `linear-gradient(90deg,transparent,${c},transparent)`,
            animation: "scanMove 2.2s linear infinite",
            flexShrink: 0,
          }}
        />
        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }}>
          <p
            style={f(13, {
              color: HEAD,
              lineHeight: 1.95,
              whiteSpace: "pre-wrap",
              margin: 0,
            })}
          >
            {typed}
            <span style={{ color: c, animation: "blink 1s step-end infinite" }}>
              █
            </span>
          </p>
        </div>
        {/* footer */}
        <div
          style={{
            ...R({ gap: 22, padding: "11px 20px", flexWrap: "wrap" }),
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          {[
            ["LATENCY", `${card.latency?.toFixed(3)}s`],
            ["STATUS", card.status?.toUpperCase()],
            ["PROVIDER", card.provider?.replace("Provider", "").toUpperCase()],
          ].map(([k, v]) => (
            <div key={k} style={R({ gap: 8 })}>
              <span style={f(9, { color: TEXT3, letterSpacing: "1px" })}>
                {k}
              </span>
              <span style={f(11, { color: c, fontWeight: 600 })}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   APP
══════════════════════════════════════ */
export default function App() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("analysis");
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [activeIdx, setAI] = useState(-1);
  const [showCards, setCards] = useState(false);
  const [modal, setModal] = useState({ card: null, idx: 0 });
  const [logs, setLogs] = useState(["SYSTEM READY"]);
  const [raw, setRaw] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  const typedAnswer = useTypewriter(
    phase === "complete" ? (data?.winner?.answer ?? "") : "",
    13,
  );
  const addLog = (msg) => setLogs((l) => [...l.slice(-12), msg]);

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setPhase("loading");
    setData(null);
    setAI(-1);
    setCards(false);
    setModal({ card: null, idx: 0 });
    setRaw(null);
    setLogs([
      "INITIALIZING...",
      `MODE: ${mode.toUpperCase()}`,
      "ROUTING TO PROVIDERS...",
    ]);
    try {
      const res = await askLLM(prompt, mode);
      setRaw(res);
      const t = transformResponse(res);
      t.race.sort((a, b) => a.latency - b.latency);
      addLog(`${t.race.length} RESPONSES RECEIVED`);
      addLog("SEMANTIC CLUSTERING...");
      setData(t);
      setPhase("revealing");
      for (let i = 0; i < t.race.length; i++) {
        setAI(i);
        addLog(
          `ONLINE: ${t.race[i].provider?.replace("Provider", "").toUpperCase()} · ${t.race[i].latency?.toFixed(2)}s`,
        );
        await delay(780);
      }
      addLog(`JUDGE: ${res.judge_used ? "ACTIVE" : "SKIPPED"}`);
      addLog(
        `WINNER → ${res.selected_provider?.replace("Provider", "").toUpperCase()}`,
      );
      setPhase("complete");
    } catch (e) {
      addLog(`ERROR: ${e.message}`);
      setPhase("idle");
    }
  };

  const reset = () => {
    setPrompt("");
    setData(null);
    setPhase("idle");
    setAI(-1);
    setCards(false);
    setModal({ card: null, idx: 0 });
    setRaw(null);
    setLogs(["SYSTEM RESET"]);
  };

  const confPct = raw?.confidence
    ? ({ very_high: 97, high: 80, moderate: 58, low: 32, none: 0 }[
        raw.confidence.certainty_level
      ] ?? 50)
    : 0;
  const confCol = confPct >= 80 ? EMERALD : confPct >= 58 ? AMBER : ROSE;
  const modalOpen = !!modal.card;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: HEAD,
        fontFamily: FONT,
        position: "relative",
        overflow: "hidden",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* deep bg glow */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `radial-gradient(ellipse at 25% 35%, rgba(245,158,11,0.04) 0%, transparent 50%),
                    radial-gradient(ellipse at 75% 65%, rgba(56,189,248,0.04) 0%, transparent 50%)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* scanline texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.006) 2px,rgba(255,255,255,0.006) 4px)",
          pointerEvents: "none",
          zIndex: 900,
        }}
      />

      {/* ── HEADER ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 500,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 22px",
          borderBottom: `1px solid ${BORDER}`,
          background: "rgba(3,6,15,0.94)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={C({ gap: 3 })}>
          <div style={R({ gap: 10 })}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: AMBER,
                boxShadow: `0 0 14px ${AMBER}`,
                animation: "pulseAmber 2s ease-in-out infinite",
              }}
            />
            <span
              style={f(14, {
                color: AMBER,
                letterSpacing: "5px",
                fontWeight: 700,
              })}
            >
              LLM ARBITER
            </span>
          </div>
          <span style={f(9, { color: TEXT3, letterSpacing: "2.5px" })}>
            MULTI-PROVIDER CONSENSUS ENGINE v2
          </span>
        </div>
        <div style={R({ gap: 9 })}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              transition: "all 0.4s",
              background:
                phase === "loading"
                  ? AMBER
                  : phase === "complete"
                    ? EMERALD
                    : "rgba(255,255,255,0.1)",
              boxShadow:
                phase === "loading"
                  ? `0 0 10px ${AMBER}`
                  : phase === "complete"
                    ? `0 0 10px ${EMERALD}`
                    : "none",
            }}
          />
          <span style={f(10, { color: TEXT3, letterSpacing: "2px" })}>
            {phase === "loading"
              ? "PROCESSING"
              : phase === "complete"
                ? "COMPLETE"
                : "STANDBY"}
          </span>
        </div>
      </header>

      {/* ── BODY ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "248px 1fr 208px",
          minHeight: "calc(100vh - 50px)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* ── LEFT PANEL ── */}
        <aside
          style={{
            padding: "16px 14px",
            borderRight: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.012)",
            overflowY: "auto",
            ...C({ gap: 18 }),
          }}
        >
          {/* QUERY */}
          <div>
            <SH>QUERY</SH>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Enter query for consensus analysis..."
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "rgba(245,158,11,0.04)",
                border: `1px solid rgba(245,158,11,0.2)`,
                borderRadius: 6,
                color: HEAD,
                fontFamily: FONT,
                fontSize: "12px",
                padding: "10px 12px",
                resize: "vertical",
                outline: "none",
                lineHeight: 1.65,
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
            <div style={R({ gap: 8, marginTop: 8 })}>
              <button
                onClick={handleAsk}
                disabled={phase === "loading" || !prompt.trim()}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  background:
                    phase === "loading"
                      ? "rgba(245,158,11,0.07)"
                      : "rgba(245,158,11,0.13)",
                  border: `1px solid ${phase === "loading" ? "rgba(245,158,11,0.15)" : AMBER}`,
                  borderRadius: 5,
                  color: phase === "loading" ? TEXT3 : AMBER,
                  fontFamily: FONT,
                  fontSize: "11px",
                  letterSpacing: "2px",
                  cursor: phase === "loading" ? "not-allowed" : "pointer",
                  boxShadow:
                    phase === "loading"
                      ? "none"
                      : `0 0 18px rgba(245,158,11,0.2)`,
                  transition: "all 0.2s",
                }}
              >
                {phase === "loading" ? "◌  PROCESSING..." : "▶  EXECUTE"}
              </button>
              {phase !== "idle" && (
                <button
                  onClick={reset}
                  style={{
                    padding: "9px 13px",
                    background: "transparent",
                    border: `1px solid ${BORDER}`,
                    borderRadius: 5,
                    color: TEXT2,
                    fontFamily: FONT,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* MODE */}
          <div>
            <SH>EXEC MODE</SH>
            <div style={C({ gap: 5 })}>
              {MODES.map((mo) => (
                <ModeBtn
                  key={mo.id}
                  {...mo}
                  active={mode === mo.id}
                  disabled={phase === "loading"}
                  onClick={() => setMode(mo.id)}
                />
              ))}
            </div>
          </div>

          {/* LOG */}
          <div>
            <SH>SYSTEM LOG</SH>
            <SysLog lines={logs} />
          </div>

          {/* METRICS */}
          {raw && phase === "complete" && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <SH>METRICS</SH>
              <div
                style={{
                  background: "rgba(245,158,11,0.04)",
                  border: "1px solid rgba(245,158,11,0.12)",
                  borderRadius: 6,
                  padding: "11px 12px",
                }}
              >
                <ConfBar conf={raw.confidence} />
              </div>
              {raw.judge_used && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "7px 11px",
                    background: `${VIOLET}0a`,
                    border: `1px solid ${VIOLET}25`,
                    borderRadius: 5,
                    color: VIOLET,
                    ...f(10),
                    letterSpacing: "1px",
                    animation: "fadeUp 0.4s ease",
                  }}
                >
                  ⚖ JUDGE ACTIVE · Gemini 2.5 Flash
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── CENTER ── */}
        <div style={{ ...C({ padding: "14px" }), overflowY: "auto" }}>
          {/* canvas */}
          <div
            style={{
              width: "100%",
              height: "450px",
              flexShrink: 0,
              position: "relative",
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              background: BG,
              overflow: "hidden",
              pointerEvents: modalOpen ? "none" : "auto",
            }}
          >
            <ChipNetwork
              providers={data?.race || []}
              activeIndex={activeIdx}
              winner={phase === "complete" ? data?.winner : null}
              phase={phase}
            />
            {phase === "idle" && (
              <div
                style={{
                  position: "absolute",
                  bottom: 14,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <span style={f(10, { color: TEXT3, letterSpacing: "3px" })}>
                  CHIP NETWORK IDLE — ENTER QUERY TO ACTIVATE
                </span>
              </div>
            )}
            {phase === "loading" && (
              <div
                style={{
                  position: "absolute",
                  bottom: 14,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  pointerEvents: "none",
                }}
              >
                <span
                  style={f(10, {
                    color: AMBER,
                    letterSpacing: "3px",
                    animation: "glow 1.2s ease-in-out infinite",
                  })}
                >
                  QUERYING PROVIDERS...
                </span>
              </div>
            )}
          </div>

          {/* ANSWER BOX */}
          {phase === "complete" && data && (
            <div
              style={{
                marginTop: 12,
                background: SURFACE,
                border: `1px solid ${EMERALD}28`,
                borderRadius: 10,
                padding: "16px 20px",
                flexShrink: 0,
                boxShadow: `0 0 30px ${EMERALD}08`,
                animation: "fadeUp 0.5s ease",
              }}
            >
              <div
                style={R({ justifyContent: "space-between", marginBottom: 10 })}
              >
                <div style={R({ gap: 8 })}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: EMERALD,
                      boxShadow: `0 0 8px ${EMERALD}`,
                    }}
                  />
                  <span
                    style={f(10, {
                      color: EMERALD,
                      letterSpacing: "3px",
                      fontWeight: 600,
                    })}
                  >
                    CONSENSUS ANSWER
                  </span>
                </div>
                <span style={f(10, { color: TEXT3 })}>
                  via{" "}
                  {data.winner.provider?.replace("Provider", "").toUpperCase()}
                </span>
              </div>
              <p
                style={f(13, {
                  color: HEAD,
                  lineHeight: 1.88,
                  margin: "0 0 14px",
                  minHeight: 18,
                })}
              >
                {typedAnswer}
                <span
                  style={{
                    color: EMERALD,
                    animation: "blink 1s step-end infinite",
                  }}
                >
                  █
                </span>
              </p>
              <button
                onClick={() => setCards((c) => !c)}
                style={{
                  padding: "7px 18px",
                  background: showCards ? `${SKY}14` : `${SKY}08`,
                  border: `1px solid ${SKY}33`,
                  borderRadius: 5,
                  color: SKY,
                  fontFamily: FONT,
                  fontSize: "10px",
                  letterSpacing: "2px",
                  cursor: "pointer",
                }}
              >
                {showCards ? "▲  HIDE PROVIDERS" : "▼  VIEW ALL RESPONSES"}
              </button>
            </div>
          )}

          {/* PROVIDER CARDS */}
          {showCards && data && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))",
                gap: 12,
                paddingBottom: 16,
              }}
            >
              {data.arena.map((p, i) => (
                <Card
                  key={p.provider || i}
                  p={p}
                  index={i}
                  isWinner={p.provider === data.winner?.provider}
                  onView={(card, idx) => setModal({ card, idx })}
                  animDelay={i * 80}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <aside
          style={{
            padding: "16px 14px",
            borderLeft: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.012)",
            overflowY: "auto",
            ...C({ gap: 16 }),
          }}
        >
          {/* PROVIDERS */}
          <div>
            <SH>PROVIDERS</SH>
            {data?.race?.length > 0 ? (
              data.race.map((p, i) => (
                <PRow
                  key={i}
                  p={p}
                  index={i}
                  activeIndex={activeIdx}
                  phase={phase}
                  isWinner={p.provider === data?.winner?.provider}
                  animDelay={i * 120}
                />
              ))
            ) : (
              <div style={f(10, { color: TEXT3, padding: "6px 0" })}>
                NO ACTIVE PROVIDERS
              </div>
            )}
          </div>

          {raw && phase === "complete" && (
            <>
              {/* CONFIDENCE TILES */}
              <div style={{ animation: "fadeUp 0.4s ease" }}>
                <SH color={EMERALD}>CONFIDENCE</SH>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                  }}
                >
                  <Tile
                    label="LEVEL"
                    value={raw.confidence?.certainty_level?.toUpperCase()}
                    c={confCol}
                  />
                  <Tile label="SCORE" value={`${confPct}%`} c={SKY} />
                  <Tile
                    label="AGREED"
                    value={`${raw.confidence?.providers_agreed}/${raw.confidence?.providers_considered}`}
                    c={VIOLET}
                  />
                  <Tile
                    label="SIMILAR"
                    value={`${((raw.confidence?.similarity_score ?? 0) * 100).toFixed(0)}%`}
                    c={EMERALD}
                  />
                </div>
              </div>

              {/* WINNER */}
              <div style={{ animation: "fadeUp 0.5s ease" }}>
                <SH color={EMERALD}>WINNER</SH>
                <div
                  style={{
                    background: `${EMERALD}0a`,
                    border: `1px solid ${EMERALD}22`,
                    borderRadius: 7,
                    padding: "11px 13px",
                  }}
                >
                  <div
                    style={f(16, {
                      color: EMERALD,
                      fontWeight: 800,
                      marginBottom: 3,
                    })}
                  >
                    {raw.selected_provider
                      ?.replace("Provider", "")
                      .toUpperCase()}
                  </div>
                  <div style={f(9, { color: TEXT3, letterSpacing: "1px" })}>
                    SELECTED BY ARBITER
                  </div>
                </div>
              </div>

              {/* EXECUTION */}
              <div style={{ animation: "fadeUp 0.6s ease" }}>
                <SH>EXECUTION</SH>
                <div style={C({ gap: 5 })}>
                  <Tile
                    label="MODE"
                    value={raw.mode?.toUpperCase()}
                    c={AMBER}
                  />
                  <Tile
                    label="JUDGE"
                    value={raw.judge_used ? "ACTIVE" : "SKIPPED"}
                    c={raw.judge_used ? EMERALD : TEXT3}
                  />
                </div>
              </div>

              {/* LATENCY BARS */}
              <div style={{ animation: "fadeUp 0.7s ease" }}>
                <SH>LATENCY</SH>
                <div style={C({ gap: 8 })}>
                  {data?.race?.map((p, i) => {
                    const c = pc(i);
                    const max = Math.max(
                      ...data.race.map((r) => r.latency || 0),
                      0.01,
                    );
                    const pct = ((p.latency || 0) / max) * 100;
                    return (
                      <div key={i}>
                        <div
                          style={R({
                            justifyContent: "space-between",
                            marginBottom: 3,
                          })}
                        >
                          <span style={f(10, { color: c, fontWeight: 600 })}>
                            {p.provider?.replace("Provider", "").toUpperCase()}
                          </span>
                          <span style={f(10, { color: TEXT2 })}>
                            {p.latency?.toFixed(2)}s
                          </span>
                        </div>
                        <div
                          style={{
                            height: 3,
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: `linear-gradient(90deg,${c}88,${c})`,
                              boxShadow: `0 0 6px ${c}80`,
                              transition:
                                "width 1.2s cubic-bezier(.22,1,.36,1)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      <Modal
        card={modal.card}
        idx={modal.idx}
        onClose={() => setModal({ card: null, idx: 0 })}
      />
    </div>
  );
}

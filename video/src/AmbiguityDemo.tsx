import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Evidence Desk palette — inherited from the app, no fake chrome.
const C = {
  bg: "#0e0b07",
  ink: "#f6efdc",
  dim: "#cfc19c",
  faint: "#968768",
  line: "#2d2514",
  accent: "#f7ad33",
  paper: "#f6efdc",
  warn: "#f7ad33",
  danger: "#ef6159",
};
const FONT_DATA = "'IBM Plex Mono', 'Consolas', monospace";
const FONT_DISP = "Georgia, 'Times New Roman', serif";

const fade = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const pop = (frame: number, fps: number, delay: number) =>
  spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 160 } });

const Tag: React.FC<{ text: string; color?: string }> = ({ text, color = C.accent }) => (
  <div
    style={{
      fontFamily: FONT_DATA,
      fontSize: 22,
      letterSpacing: 4,
      textTransform: "uppercase" as const,
      color,
      border: `1.5px solid ${color}`,
      padding: "6px 16px",
      borderRadius: 4,
      display: "inline-block",
    }}
  >
    {text}
  </div>
);

const Stamp: React.FC<{ text: string; warn?: boolean; frame: number; fps: number; delay: number }> = ({
  text, warn, frame, fps, delay,
}) => {
  const s = pop(frame, fps, delay);
  return (
    <div
      style={{
        fontFamily: FONT_DISP,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 3,
        textTransform: "uppercase" as const,
        color: warn ? "#141a16" : C.paper,
        background: warn ? C.warn : "transparent",
        border: `3px solid ${warn ? C.warn : C.paper}`,
        borderRadius: 6,
        padding: "8px 22px",
        transform: `rotate(-2.5deg) scale(${0.6 + 0.4 * s})`,
        opacity: s,
        display: "inline-block",
      }}
    >
      {text}
    </div>
  );
};

interface Row { num: string; name: string; sym: string; chain: string; liq: string; tr: string; flag?: string; flagColor?: string; dim?: boolean; win?: boolean }

const ExRow: React.FC<{ r: Row; i: number; frame: number; fps: number; base: number }> = ({ r, i, frame, fps, base }) => {
  const s = pop(frame, fps, base + i * 6);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1.6fr 1fr 1fr 1fr 1.1fr",
        gap: 24,
        padding: "14px 20px",
        borderBottom: `1px solid ${C.line}`,
        fontFamily: FONT_DATA,
        fontSize: 24,
        opacity: r.dim ? 0.45 * s : s,
        transform: `translateY(${(1 - s) * 18}px)`,
        background: r.win ? "rgba(126,200,154,0.09)" : "transparent",
        color: r.dim ? C.faint : C.ink,
        alignItems: "center",
      }}
    >
      <span style={{ color: C.faint }}>{r.num}</span>
      <span style={{ fontWeight: 600 }}>
        {r.name} <span style={{ color: C.accent, fontSize: 20 }}>{r.sym}</span>
        {r.flag && (
          <span style={{ marginLeft: 12, fontSize: 16, color: r.flagColor ?? C.warn, border: `1px solid ${r.flagColor ?? C.warn}`, padding: "2px 8px", borderRadius: 3 }}>
            {r.flag}
          </span>
        )}
      </span>
      <span style={{ color: C.dim }}>{r.chain}</span>
      <span style={{ textAlign: "right" }}>{r.liq}</span>
      <span style={{ textAlign: "right" }}>{r.tr}</span>
      <span style={{ textAlign: "right", color: r.win ? C.accent : C.dim, fontWeight: r.win ? 700 : 400 }}>{r.flag ? "—" : ""}</span>
    </div>
  );
};

const Scene: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const f = useCurrentFrame();
  const o = fade(f, from, from + 12) * (1 - fade(f, to - 12, to));
  if (f < from - 20 || f > to + 20) return null;
  return (
    <AbsoluteFill style={{ opacity: o, padding: "90px 110px", justifyContent: "flex-start" }}>
      {children}
    </AbsoluteFill>
  );
};

const QueryBar: React.FC<{ q: string; frame: number; delay: number }> = ({ q, frame, delay }) => {
  const chars = Math.max(0, Math.floor((frame - delay) / 2));
  return (
    <div
      style={{
        fontFamily: FONT_DATA,
        fontSize: 44,
        color: C.ink,
        border: `2px solid ${C.line}`,
        borderRadius: 10,
        padding: "18px 28px",
        display: "inline-flex",
        gap: 2,
        background: "rgba(255,255,255,0.02)",
        marginTop: 24,
        marginBottom: 36,
      }}
    >
      <span style={{ color: C.faint }}>resolve&nbsp;›&nbsp;</span>
      <span>{q.slice(0, chars)}</span>
      <span style={{ opacity: frame % 30 < 15 ? 1 : 0, color: C.accent }}>▌</span>
    </div>
  );
};

// VO timing (30fps): one line per scene, generated per voice set.
// Fast cut: 1600f ≈ 53s. Each track lands fully INSIDE its scene — no bleed.
const VO = [
  { file: "vo-s0.mp3", from: 2 },      // title (scene 0–90)
  { file: "vo-s1.mp3", from: 105 },    // PEPE collision (90–580)
  { file: "vo-s2.mp3", from: 595 },    // WIF $-trap (580–960)
  { file: "vo-s3.mp3", from: 975 },    // USDT family (960–1290)
  { file: "vo-s4.mp3", from: 1310 },   // closing (1290–1600)
];

export const AmbiguityDemo: React.FC<{ voDir?: string }> = ({ voDir = "" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: C.bg, color: C.ink, fontFamily: FONT_DATA }}>
      {VO.map((v) => (
        <Sequence key={v.file} from={v.from}>
          <Audio src={staticFile(voDir ? `${voDir}/${v.file}` : v.file)} />
        </Sequence>
      ))}
      {/* S0 — Title (0–90) */}
      <Scene from={0} to={90}>
        <div style={{ marginTop: 160 }}>
          <Tag text="evidence desk · coinmarketcap dex api" />
          <div style={{ fontFamily: FONT_DISP, fontSize: 118, fontWeight: 700, marginTop: 36, lineHeight: 1.05 }}>
            Ambiguity<span style={{ color: C.accent }}>Desk</span>
          </div>
          <div style={{ fontSize: 34, color: C.dim, marginTop: 28, opacity: fade(frame, 30, 60) }}>
            "PEPE yang mana yang asli?" — every candidate, one answer.
          </div>
        </div>
      </Scene>

      {/* S1 — PEPE collision (90–580) */}
      <Scene from={90} to={580}>
        <Tag text="case 01 — ticker collision" />
        <QueryBar q="pepe" frame={frame} delay={110} />
        <div style={{ fontSize: 22, color: C.faint, marginBottom: 10, opacity: fade(frame, 180, 210) }}>
          50 candidates · 32 exact-symbol matches · 11 chains — in ONE CMC call
        </div>
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
          {([
            { num: "EX-01", name: "Pepe", sym: "PEPE", chain: "Ethereum", liq: "$34.16M", tr: "557", win: true },
            { num: "EX-02", name: "Pepe", sym: "PEPE", chain: "Solana", liq: "$186K", tr: "3,086", flag: "possible-farming", flagColor: C.danger },
            { num: "EX-03", name: "Pepe", sym: "PEPE", chain: "Base", liq: "$398K", tr: "412" },
            { num: "EX-04", name: "PePe", sym: "PEPE", chain: "TRON", liq: "$191K", tr: "98" },
            { num: "EX-05", name: "Pepe", sym: "PEPE", chain: "Arbitrum", liq: "$86K", tr: "31", flag: "mcap inflated" },
          ] as Row[]).map((r, i) => (
            <ExRow key={r.num} r={r} i={i} frame={frame} fps={fps} base={220} />
          ))}
        </div>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 32 }}>
          <Stamp text="best pick" frame={frame} fps={fps} delay={430} />
          <div style={{ fontSize: 26, color: C.dim, opacity: fade(frame, 470, 510) }}>
            Ethereum PEPE · <span style={{ color: C.accent }}>21.5×</span> the runner-up · heuristic, not proof
          </div>
        </div>
      </Scene>

      {/* S2 — WIF $-trap (580–960) */}
      <Scene from={580} to={960}>
        <Tag text="case 02 — the $-prefix trap" />
        <QueryBar q="wif" frame={frame} delay={600} />
        <div style={{ display: "flex", gap: 60, marginTop: 10 }}>
          <div style={{ flex: 1, opacity: fade(frame, 655, 695) }}>
            <div style={{ fontSize: 20, letterSpacing: 3, color: C.danger, marginBottom: 14 }}>NAIVE MATCH ✗</div>
            <div style={{ border: `1px solid ${C.danger}`, borderRadius: 10, padding: 24, fontSize: 24 }}>
              <div style={{ fontWeight: 700 }}>lizardwifsunglasses <span style={{ color: C.faint }}>WIF</span></div>
              <div style={{ color: C.dim, marginTop: 8 }}>Solana · $20.2K pool · a pump.fun clone</div>
              <div style={{ color: C.danger, marginTop: 12, fontSize: 20, textDecoration: "line-through" }}>wrong pick</div>
            </div>
          </div>
          <div style={{ flex: 1, opacity: fade(frame, 755, 805) }}>
            <div style={{ fontSize: 20, letterSpacing: 3, color: C.accent, marginBottom: 14 }}>AMBIGUITYDESK ✓</div>
            <div style={{ border: `1px solid ${C.accent}`, borderRadius: 10, padding: 24, fontSize: 24 }}>
              <div style={{ fontWeight: 700 }}>dogwifhat <span style={{ color: C.accent }}>$WIF</span></div>
              <div style={{ color: C.dim, marginTop: 8 }}>Solana · $7.09M pool · 2,628 traders</div>
              <div style={{ color: C.accent, marginTop: 12, fontSize: 20 }}>canonical wins · 1,740×</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 24, color: C.dim, marginTop: 40, opacity: fade(frame, 850, 890) }}>
          The real dogwifhat is listed as <b style={{ color: C.paper }}>$WIF</b>. Match it or crown a clone.
        </div>
      </Scene>

      {/* S3 — USDT family (960–1290) */}
      <Scene from={960} to={1290}>
        <Tag text="case 03 — when the question is wrong" />
        <QueryBar q="usdt" frame={frame} delay={980} />
        <div style={{ opacity: fade(frame, 1050, 1080) }}>
          <Stamp text="multi-chain asset" frame={frame} fps={fps} delay={1055} />
          <div style={{ fontSize: 24, color: C.dim, margin: "26px 0" }}>
            One canonical listing · deep pools on 26 chains. There is no single "real" USDT — pick your chain.
          </div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
            {([
              { num: "—", name: "Tether USD", sym: "USDT", chain: "Ethereum", liq: "$41.2M", tr: "—" },
              { num: "—", name: "Tether USD", sym: "USDT", chain: "BSC", liq: "$38.7M", tr: "—" },
              { num: "—", name: "Tether USD", sym: "USDT", chain: "Tron", liq: "$29.4M", tr: "—" },
              { num: "—", name: "Tether USD", sym: "USDT", chain: "Polygon", liq: "$18.1M", tr: "—" },
            ] as Row[]).map((r, i) => (
              <ExRow key={r.chain} r={r} i={i} frame={frame} fps={fps} base={1130} />
            ))}
          </div>
        </div>
      </Scene>

      {/* S4 — closing (1290–1600) */}
      <Scene from={1290} to={1600}>
        <div style={{ marginTop: 120, textAlign: "center", width: "100%" }}>
          <div style={{ fontFamily: FONT_DISP, fontSize: 96, fontWeight: 700, opacity: fade(frame, 1315, 1350) }}>
            evidence, <span style={{ color: C.accent }}>not guesses.</span>
          </div>
          <div style={{ fontSize: 30, color: C.dim, marginTop: 40, opacity: fade(frame, 1395, 1435) }}>
            ambiguitydesk.pages.dev · deterministic · replay-verified · no AI deciding for you
          </div>
          <div style={{ marginTop: 60, opacity: fade(frame, 1480, 1520) }}>
            <Tag text="#buildwithcmc" />
          </div>
        </div>
      </Scene>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill } from "remotion";

const C = {
  bg: "#0e0b07",
  ink: "#f6efdc",
  dim: "#cfc19c",
  faint: "#968768",
  line: "#2d2514",
  accent: "#f7ad33",
  danger: "#ef6159",
};
const FONT_DATA = "'IBM Plex Mono', 'Consolas', monospace";
const FONT_DISP = "Georgia, 'Times New Roman', serif";

const rows = [
  { name: "Pepe", chain: "Ethereum", liq: "$34.16M", win: true },
  { name: "Pepe", chain: "Solana", liq: "$186K" },
  { name: "Pepe", chain: "Base", liq: "$398K" },
  { name: "PePe", chain: "TRON", liq: "$191K" },
];

export const AmbiguityThumb: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT_DATA, color: C.ink, display: "flex", flexDirection: "row" }}>
    {/* left — headline */}
    <div style={{ flex: 1.15, padding: "64px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 24, letterSpacing: 4, color: C.accent, textTransform: "uppercase" as const, marginBottom: 20 }}>
        evidence desk · CMC dex api
      </div>
      <div style={{ fontFamily: FONT_DISP, fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
        Which PEPE is<br />the <span style={{ color: C.accent }}>real</span> one?
      </div>
      <div style={{ fontFamily: FONT_DISP, fontSize: 44, fontWeight: 700, marginTop: 34, color: C.ink }}>
        Ambiguity<span style={{ color: C.accent }}>Desk</span>
      </div>
    </div>
    {/* right — collision table */}
    <div style={{ flex: 1, padding: "64px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 20, color: C.faint, marginBottom: 14, letterSpacing: 2 }}>50 candidates · 11 chains · 1 call</div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        {rows.map((r) => (
          <div
            key={r.chain}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: `1px solid ${C.line}`,
              fontSize: 26,
              background: r.win ? "rgba(126,200,154,0.10)" : "transparent",
              color: r.win ? C.ink : C.faint,
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.name} <span style={{ color: C.accent }}>PEPE</span></span>
            <span>{r.chain}</span>
            <span style={{ color: r.win ? C.accent : C.dim, fontWeight: r.win ? 700 : 400 }}>{r.liq}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, display: "inline-block" }}>
        <span
          style={{
            fontFamily: FONT_DISP,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase" as const,
            color: "#141a16",
            background: C.accent,
            borderRadius: 6,
            padding: "8px 20px",
            transform: "rotate(-2.5deg)",
            display: "inline-block",
          }}
        >
          best pick ✓
        </span>
      </div>
    </div>
  </AbsoluteFill>
);

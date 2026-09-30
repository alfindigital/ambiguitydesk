// AmbiguityDesk front-end: one endpoint, one table, zero decoration.
// States: idle / loading / error / notFound / result. Everything data is
// rendered from the API payload; nothing is invented client-side.
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const form = $("#searchForm");
  const input = $("#q");
  const resultBox = $("#result");
  let inflight = null;

  const themeBtn = $("#themeToggle");
  themeBtn?.addEventListener("click", () => {
    const toLight = document.documentElement.dataset.theme !== "light";
    if (toLight) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try { toLight ? localStorage.setItem("ad-theme", "light") : localStorage.removeItem("ad-theme"); } catch {}
  });

  const EXPLORERS = {
    ethereum: "https://etherscan.io/token/",
    bsc: "https://bscscan.com/token/",
    solana: "https://solscan.io/token/",
    base: "https://basescan.org/token/",
    arbitrum: "https://arbiscan.io/token/",
    optimism: "https://optimistic.etherscan.io/token/",
    polygon: "https://polygonscan.com/token/",
    avalanche: "https://snowtrace.io/token/",
    gnosis: "https://gnosisscan.io/token/",
    tron: "https://tronscan.org/#/token20/",
    "sui network": "https://suiscan.xyz/mainnet/coin/",
    near: "https://nearblocks.io/token/",
  };
  const explorerFor = (platform) => EXPLORERS[platform.toLowerCase()] ?? null;

  const fmtUsd = (v) => {
    if (v === null || v === undefined) return "unknown";
    if (v >= 1e15) return `$${v.toExponential(1)}`; // absurd values stay honest, not overflowing
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  const fmtInt = (v) => (v === null || v === undefined ? "unknown" : v.toLocaleString("en-US"));
  const fmtScore = (v) =>
    v === null || v === undefined ? "no score" : v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  const fmtDelta = (v) => {
    if (v === null || v === undefined) return { text: "unknown", cls: "flat" };
    const pct = v * 100;
    return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`, cls: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat" };
  };
  const shortAddr = (a) => (a.length <= 16 ? a : `${a.slice(0, 7)}…${a.slice(-5)}`);

  const FLAG_LABEL = {
    "mcap-inflated": ["mcap inflated", "warn"],
    "thin-pool": ["thin pool", "warn"],
    "no-traders": ["no traders", "danger"],
    "data-gap": ["data gap", ""],
    "possible-farming": ["farmed?", "danger"],
    "young-pool": ["young pool", "warn"],
    "offchain-venue": ["off-chain venue", ""],
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function setState(kind, payload) {
    if (kind === "loading") {
      resultBox.innerHTML = "";
      const wrap = el("div", "skel-wrap");
      wrap.setAttribute("aria-busy", "true");
      for (let i = 0; i < 4; i++) wrap.append(el("div", "skel-row"));
      resultBox.append(wrap);
      return;
    }
    if (kind === "error") {
      resultBox.innerHTML = "";
      const box = el("div", "error-state");
      box.append(el("p", "", `Resolution failed: ${payload}`));
      box.append(el("p", "state-note", "Fix the query or retry."));
      resultBox.append(box);
      return;
    }
    if (kind === "notfound") {
      resultBox.innerHTML = "";
      const box = el("div", "notfound-state");
      box.append(el("p", "", `No token answers to "${payload}".`));
      box.append(el("p", "state-note", "Zero rows from DEX search, or outside the replay fixtures."));
      resultBox.append(box);
      return;
    }
  }

  const COPY_SVG = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.2" y="5.2" width="8" height="8" rx="1.5"/><path d="M10.8 5.2V3.7a1.5 1.5 0 0 0-1.5-1.5H3.7a1.5 1.5 0 0 0-1.5 1.5v5.6a1.5 1.5 0 0 0 1.5 1.5h1.5"/></svg>`;
  const CHECK_SVG = `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>`;

  function copyButton(address) {
    const btn = el("button", "addr-copy");
    btn.type = "button";
    btn.title = "Copy address";
    btn.setAttribute("aria-label", "Copy address");
    btn.innerHTML = COPY_SVG;
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(address);
        btn.innerHTML = CHECK_SVG;
        btn.classList.add("done");
        setTimeout(() => { btn.innerHTML = COPY_SVG; btn.classList.remove("done"); }, 1400);
      } catch {
        btn.title = "Select + Ctrl-C";
      }
    });
    return btn;
  }

  function candidateRow(c, i, maxScore, clusterSizes) {
    const row = el("div", "exhibit");
    if (c.eligible === false) row.classList.add("is-dead");

    row.append(el("span", "ex-num", `EX-${String(i + 1).padStart(2, "0")}`));

    const id = el("div", "ex-id");
    // only render http(s) logos; ipfs:// and other schemes can't load in img
    if (c.logo && /^https?:\/\//.test(c.logo)) {
      const img = el("img", "ex-logo");
      img.src = c.logo;
      img.alt = "";
      img.loading = "lazy";
      img.width = 22; img.height = 22;
      img.addEventListener("error", () => img.remove());
      id.append(img);
    }
    const nameWrap = el("div", "");
    const name = el("div", "ex-name");
    name.append(document.createTextNode(c.name || "?"));
    name.append(el("span", "sym", ` ${c.symbol}`));
    nameWrap.append(name);
    const flagWrap = el("div", "ex-flags");
    for (const f of c.flags ?? []) {
      const [label, cls] = FLAG_LABEL[f] ?? [f, ""];
      flagWrap.append(el("span", `flag ${cls}`, label));
    }
    if (c.cluster && (clusterSizes.get(c.cluster) ?? 0) > 1) {
      flagWrap.append(el("span", "flag same", `same contract x${clusterSizes.get(c.cluster)}`));
    }
    if (flagWrap.childElementCount) nameWrap.append(flagWrap);
    id.append(nameWrap);
    row.append(id);

    row.append(el("span", "ex-chain", c.platform));

    const addr = el("div", "ex-addr");
    const exp = explorerFor(c.platform);
    let at;
    if (exp) {
      at = el("a", "addr-text", shortAddr(c.address));
      at.href = exp + encodeURIComponent(c.address);
      at.target = "_blank";
      at.rel = "noopener noreferrer";
    } else {
      at = el("span", "addr-text", shortAddr(c.address));
    }
    at.title = c.address;
    addr.append(at, copyButton(c.address));
    row.append(addr);

    const stats = el("div", "ex-stats");
    stats.append(el("span", `ex-num-cell${c.liqUsd === null ? " na" : ""}`, fmtUsd(c.liqUsd)));
    stats.children[0].dataset.k = "liq";
    stats.append(el("span", `ex-num-cell${c.uniqueTraders24h === null ? " na" : ""}`, fmtInt(c.uniqueTraders24h)));
    stats.children[1].dataset.k = "traders";
    stats.append(el("span", `ex-num-cell${c.mcapUsd === null ? " na" : ""}`, fmtUsd(c.mcapUsd)));
    stats.children[2].dataset.k = "mcap";
    const d = fmtDelta(c.priceChange24h);
    stats.append(el("span", `ex-num-cell delta ${d.cls}`, d.text));
    stats.children[3].dataset.k = "24h";
    row.append(stats);

    const scoreCell = el("div", "score-cell");
    const bar = el("div", "score-bar");
    const fill = el("div", `score-fill${i === 0 ? "" : " runner"}`);
    const pct = c.score !== null && c.score !== undefined && maxScore > 0 ? Math.max(1.5, (c.score / maxScore) * 100) : 0;
    fill.style.width = `${pct}%`;
    bar.append(fill);
    const sv = el("span", "score-val", fmtScore(c.score));
    if (c.score !== null && c.score !== undefined) sv.title = `liq ${fmtUsd(c.liqUsd)} x ut24h ${fmtInt(c.uniqueTraders24h)} = ${Math.round(c.score).toLocaleString("en-US")}`;
    scoreCell.append(bar, sv);
    row.append(scoreCell);

    return row;
  }

  function headerRow() {
    const head = el("div", "exhibit-head");
    for (const t of ["#", "candidate", "chain", "address", "liquidity", "traders 24h", "mcap", "24h", "liq×ut24h"]) {
      const numeric = ["liquidity", "traders 24h", "mcap", "24h"].includes(t);
      head.append(el("span", numeric ? "num-h" : "", t));
    }
    return head;
  }

  function renderPick(pick) {
    const strip = el("div", "pick-strip");
    const stamp = el("div", `pick-stamp${pick.label === "close-call" ? " close" : ""}`, pick.label === "close-call" ? "close call" : "best pick");
    strip.append(stamp);

    const body = el("div", "pick-body");
    const nameLine = el("div", "pick-name");
    nameLine.append(document.createTextNode(`${pick.candidate.name} `));
    nameLine.append(el("span", "sym", pick.candidate.symbol));
    nameLine.append(document.createTextNode(` · ${pick.candidate.platform}`));
    body.append(nameLine);
    const addrLine = el("div", "pick-addr");
    const pexp = explorerFor(pick.candidate.platform);
    if (pexp) {
      const link = el("a", "", pick.candidate.address);
      link.href = pexp + encodeURIComponent(pick.candidate.address);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      addrLine.append(link);
    } else addrLine.append(el("span", "", pick.candidate.address));
    body.append(addrLine);
    strip.append(body);
    const actions = el("div", "pick-actions");
    actions.append(copyButton(pick.candidate.address));
    if (pexp) {
      const go = el("a", "addr-exp", "explorer ↗");
      go.href = pexp + encodeURIComponent(pick.candidate.address);
      go.target = "_blank";
      go.rel = "noopener noreferrer";
      actions.append(go);
    }
    strip.append(actions);

    const reason = el("div", "pick-reason");
    reason.append(el("b", "", "Why: "));
    reason.append(document.createTextNode(pick.reason));
    reason.append(el("div", "pick-caveat", "Heuristic pick — depth and trader counts can be bought. Verify on the explorer."));
    strip.append(reason);
    return strip;
  }

  function receiptRows(r) {
    return [
      ["endpoint", `${r.endpoint}?q=${r.query}`],
      ["captured", r.capturedAt ?? "unknown"],
      ["sha256", r.bodySha256 ? `${r.bodySha256.slice(0, 16)}…` : "unknown"],
      ["credits", r.credits ?? "unknown"],
      ["mode", r.mode],
    ];
  }

  function renderAudit(r) {
    const det = el("details", "audit");
    const sum = el("summary", "", `audit · ${r.mode} · ${r.credits ?? "?"} credit`);
    det.append(sum);
    const body = el("div", "audit-body");
    for (const [k, v] of receiptRows(r)) {
      const s = el("span", "");
      s.append(el("b", "", `${k}: `), document.createTextNode(String(v)));
      body.append(s);
    }
    det.append(body);
    return det;
  }

  function fillReceiptSlot(r) {
    const slot = $("#receiptSlot");
    if (!slot) return;
    slot.innerHTML = "";
    slot.append(el("b", "", "last resolve — "));
    for (const [k, v] of receiptRows(r)) {
      const row = el("div", "r-row");
      row.append(el("b", "", `${k}:`), document.createTextNode(` ${v}`));
      slot.append(row);
    }
  }

  function renderFamily(family, query) {
    const box = el("div", "family-box");
    const stamp = el("div", "pick-stamp family", "multi-chain asset");
    box.append(stamp);
    const note = el("div", "pick-reason");
    note.append(el("b", "", "Reframed: "));
    note.append(document.createTextNode(
      `"${query}" is one asset on many chains — no single "real" one. ` +
      `Pick the chain you're trading on:`));
    box.append(note);
    for (const f of family) {
      const row = el("div", "family-row");
      row.append(el("span", "ex-chain", f.platform));
      const nm = el("span", "family-name");
      nm.append(document.createTextNode(f.name || "?"), el("span", "sym", ` ${f.symbol}`));
      row.append(nm);
      let addr;
      const fexp = explorerFor(f.platform);
      if (fexp) {
        addr = el("a", "family-addr", shortAddr(f.address));
        addr.href = fexp + encodeURIComponent(f.address);
        addr.target = "_blank";
        addr.rel = "noopener noreferrer";
      } else addr = el("span", "family-addr", shortAddr(f.address));
      addr.title = f.address;
      row.append(addr);
      row.append(copyButton(f.address));
      row.append(el("span", "family-liq", fmtUsd(f.liqUsd)));
      row.append(el("span", "family-tr", `${fmtInt(f.uniqueTraders24h)} traders`));
      box.append(row);
    }
    return box;
  }

  function renderResult(r) {
    resultBox.innerHTML = "";

    const stats = el("p", "stats-line");
    stats.append(
      el("b", "", `${r.stats.exactCount}`),
      document.createTextNode(` exact-symbol ${r.stats.exactCount === 1 ? "match" : "matches"} · `),
      el("b", "", `${r.stats.relatedCount}`),
      document.createTextNode(` related · `),
      el("b", "", `${r.stats.chainCount}`),
      document.createTextNode(` chains · ${r.stats.clusterCount} distinct contracts`),
    );
    if (r.stats.farmingFlagged) {
      stats.append(document.createTextNode(" · "), el("b", "stat-danger", `${r.stats.farmingFlagged}`),
        document.createTextNode(" farming-flagged"));
    }
    if (r.stats.elsewhereCount) {
      stats.append(document.createTextNode(" · "), document.createTextNode(`${r.stats.elsewhereCount} off-chain venue listings`));
    }
    stats.append(renderAudit(r));
    fillReceiptSlot(r);
    resultBox.append(stats);

    const exact = r.candidates.filter((c) => c.bucket === "exact");
    const related = r.candidates.filter((c) => c.bucket === "related");
    const elsewhere = r.candidates.filter((c) => c.bucket === "elsewhere");
    const clusterSizes = new Map();
    for (const c of r.candidates) if (c.cluster) clusterSizes.set(c.cluster, (clusterSizes.get(c.cluster) ?? 0) + 1);
    const maxScore = Math.max(0, ...r.candidates.map((c) => c.score ?? 0));

    if (r.resolution === "family" && r.family?.length) {
      resultBox.append(renderFamily(r.family, r.query));
    } else if (r.pick) resultBox.append(renderPick(r.pick));
    else {
      const box = el("div", "notfound-state");
      box.append(el("p", "", exact.length
        ? "No candidate has both liquidity and trader data. No pick is better than a fake pick."
        : `No exact "${r.query}" deployment in this result set — nearest matches below. No pick is better than a wrong pick.`));
      resultBox.append(box);
    }

    if (exact.length) {
      resultBox.append(headerRow());
      exact.forEach((c, i) => resultBox.append(candidateRow(c, i, maxScore, clusterSizes)));
    }

    if (related.length) {
      const det = el("details", "related");
      const sum = el("summary", "", `Also matched: ${related.length} name/symbol partials`);
      det.append(sum, headerRow());
      related.forEach((c, i) => det.append(candidateRow(c, exact.length + i, maxScore, clusterSizes)));
      resultBox.append(det);
    }

    if (elsewhere.length) {
      const det = el("details", "related");
      const sum = el("summary", "", `Listed elsewhere: ${elsewhere.length} off-chain venue rows — excluded`);
      det.append(sum, headerRow());
      elsewhere.forEach((c, i) => det.append(candidateRow(c, exact.length + related.length + i, maxScore, clusterSizes)));
      resultBox.append(det);
    }

  }

  async function resolve(q) {
    const query = q.trim().replace(/^\$/, "");
    if (!query) return;
    input.value = query;
    history.replaceState(null, "", `?q=${encodeURIComponent(query)}`);

    inflight?.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    setState("loading");
    form.querySelector("button[type=submit]").disabled = true;
    try {
      const res = await fetch(`/api/resolve?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      const body = await res.json().catch(() => null);
      if (res.status === 404) { setState("notfound", body?.query ?? query); return; }
      if (!res.ok || !body?.ok) { setState("error", body?.error ?? `http ${res.status}`); return; }
      if (!body.candidates?.length) { setState("notfound", body.query ?? query); return; }
      renderResult(body);
    } catch (e) {
      if (e?.name !== "AbortError") setState("error", e instanceof Error ? e.message : "network");
    } finally {
      form.querySelector("button[type=submit]").disabled = false;
    }
  }

  const modal = $("#howModal");
  $("#howBtn")?.addEventListener("click", () => { modal.hidden = false; });
  $("#howClose")?.addEventListener("click", () => { modal.hidden = true; });
  modal?.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal && !modal.hidden) modal.hidden = true; });

  form.addEventListener("submit", (e) => { e.preventDefault(); resolve(input.value); });
  document.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => resolve(chip.dataset.q)),
  );

  const initial = new URLSearchParams(location.search).get("q");
  if (initial) resolve(initial);
})();

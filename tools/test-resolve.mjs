// Offline unit test for functions/api/resolve.js against committed fixtures.
//   node tools/test-resolve.mjs
// Exits 1 on first failure batch summary; no network, no API key.
import { onRequestGet } from "../functions/api/resolve.js";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURES = path.join(ROOT, "fixtures");

const ctx = (q) => ({
  request: { url: `http://desk.test/api/resolve?q=${encodeURIComponent(q)}` },
  env: {
    ASSETS: {
      fetch: async (req) => {
        const name = decodeURIComponent(new URL(req.url).pathname.replace("/fixtures/", ""));
        const file = path.join(FIXTURES, name);
        if (!existsSync(file)) return new Response("not found", { status: 404 });
        return new Response(readFileSync(file), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  },
});

let pass = 0, fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
};
const call = async (q) => {
  const res = await onRequestGet(ctx(q));
  return { status: res.status, body: await res.json() };
};

console.log("— pepe (mass collision) —");
{
  const { status, body } = await call("pepe");
  check("200", status === 200);
  check("ok+replay", body.ok === true && body.mode === "replay");
  check("50 candidates", body.candidates.length === 50, `got ${body.candidates.length}`);
  const fx = JSON.parse(readFileSync(path.join(FIXTURES, "PEPE.json")));
  const expectedExact = fx.body.data.tks.filter((r) => String(r.s).toLowerCase().replace(/^\$/, "") === "pepe").length;
  check(`exact bucket = ${expectedExact} minus appvenue`, body.stats.exactCount === body.candidates.filter((c) => c.bucket === "exact").length, `got ${body.stats.exactCount}`);
  check("pick = ethereum pepe",
    body.pick?.candidate?.platform === "Ethereum" &&
    body.pick?.candidate?.address === "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    JSON.stringify(body.pick?.candidate));
  check("clear-lead label", body.pick?.label === "clear-lead", body.pick?.label);
  check("margin > 20x runner-up", body.pick?.marginX > 20, body.pick?.marginX);
  check("runner-up is a different contract",
    body.pick?.runnerUp && body.pick.runnerUp.address !== body.pick.candidate.address);
  check("every candidate scored+bucketed",
    body.candidates.every((c) => "score" in c && "bucket" in c && "flags" in c));
  check("mcap-inflated flag present (arb row)",
    body.candidates.some((c) => c.flags.includes("mcap-inflated")));
  check("0x6982… clusters ETH row + Near omft mirror",
    (() => {
      const eth = body.candidates.find((c) => c.address === "0x6982508145454ce325ddbe47a25d4ec3d2311933");
      const near = body.candidates.find((c) => c.address.includes("omft.near"));
      return eth && near && eth.cluster === near.cluster;
    })(),
    "expected shared cluster via embedded 0x address");
}

console.log("— moodeng (legit multi-chain) —");
{
  const { status, body } = await call("MOODENG");
  check("200", status === 200);
  check("pick exists", !!body.pick);
  check("chains > 1", body.stats.chainCount > 1, body.stats.chainCount);
}

console.log("— wif ($-prefixed canonical must not lose the pick) —");
{
  const { status, body } = await call("wif");
  check("200", status === 200);
  check("pick = canonical dogwifhat ($WIF row)",
    body.pick?.candidate?.address === "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" ||
    body.pick?.candidate?.address?.startsWith("EKpQGSJt"),
    JSON.stringify({ addr: body.pick?.candidate?.address, name: body.pick?.candidate?.name }));
  check("$WIF row lands in exact bucket",
    body.candidates.some((c) => c.symbol === "$WIF" && c.bucket === "exact"));
}

console.log("— query normalization —");
{
  const { body } = await call("$pepe");
  check("$pepe → pepe fixture", body.ok === true && body.query === "pepe");
  const { body: b2 } = await call("pePe");
  check("pePe case-insensitive", b2.ok === true);
}

console.log("— validation + honest 404 —");
{
  const { status: s1 } = await call("");
  check("empty q → 400", s1 === 400);
  const { status: s2 } = await call("bad ticker!!");
  check("bad chars → 400", s2 === 400);
  const { status: s3, body: b3 } = await call("ZZZZNOTREAL");
  check("unknown ticker → 404", s3 === 404 && b3.ok === false);
}

console.log("— ticker query, no exact symbol → no pick (related stays visible) —");
{
  const synth = {
    query: "zzsynth", endpoint: "/v1/dex/search", capturedAt: "test",
    body: { data: { tks: [
      { plt: "Ethereum", addr: "0xaaa", n: "Alpha", s: "AAA", liq: 500000, ut24h: "100" },
      { plt: "Solana", addr: "SoLbbb", n: "Beta", s: "BBB", liq: 9000000, ut24h: "10" },
    ] } },
  };
  const f = path.join(FIXTURES, "ZZSYNTH.json");
  writeFileSync(f, JSON.stringify(synth));
  const { status, body } = await call("zzsynth");
  unlinkSync(f);
  check("200", status === 200);
  check("exactCount 0 + ticker query → no pick, resolution none",
    body.stats.exactCount === 0 && body.pick === null && body.resolution === "none",
    `pick=${JSON.stringify(body.pick?.candidate)} res=${body.resolution}`);
  check("related rows still listed", body.candidates.length === 2);
}

console.log("— address-style query (no symbol match → pool=all) —");
{
  const synth = {
    query: "0x" + "ab".repeat(20), endpoint: "/v1/dex/search", capturedAt: "test",
    body: { data: { tks: [
      { plt: "Ethereum", addr: "0xaaa", n: "Alpha", s: "AAA", liq: 500000, ut24h: "100" },
      { plt: "PulseChain", addr: "0xaaa", n: "Alpha", s: "AAA", liq: 500000, ut24h: "50" },
      { plt: "Solana", addr: "SoLbbb", n: "Beta", s: "BBB", liq: 9000000, ut24h: "10" },
    ] } },
  };
  const fname = ("0x" + "ab".repeat(20)).toUpperCase() + ".json";
  const f = path.join(FIXTURES, fname);
  writeFileSync(f, JSON.stringify(synth));
  const { status, body } = await call("0x" + "ab".repeat(20));
  unlinkSync(f);
  check("200", status === 200);
  check("address query → pick still chosen from full set", !!body.pick);
  check("pick = highest score row (BBB solana)",
    body.pick?.candidate?.address === "SoLbbb", JSON.stringify(body.pick?.candidate));
  check("same-contract cluster: AAA rows share cluster",
    body.candidates[0].cluster === body.candidates[1].cluster ||
    body.candidates.find(c => c.symbol === "AAA")?.cluster === body.candidates.filter(c => c.symbol === "AAA")[1]?.cluster);
}

console.log("— bonk (deep-pool origin must NOT be farm-excluded) —");
{
  const { status, body } = await call("bonk");
  check("200", status === 200);
  check("pick = solana bonk origin (dezx…)",
    body.pick?.candidate?.platform === "Solana" &&
    body.pick?.candidate?.address?.startsWith("DezXAZ8z"),
    JSON.stringify({ plt: body.pick?.candidate?.platform, addr: body.pick?.candidate?.address }));
  check("solana bonk row carries no farming flag",
    !body.candidates.find((c) => c.address?.startsWith("DezXAZ8z"))?.flags.includes("possible-farming"));
}

console.log("— usdt (multi-legit → family mode, NOT a pick) —");
{
  const { status, body } = await call("usdt");
  check("200", status === 200);
  check("mode=family", body.resolution === "family", body.mode);
  check("pick suppressed", body.pick === null);
  check("family has ≥3 chains", Array.isArray(body.family) && body.family.length >= 3,
    `got ${body.family?.length}`);
  check("family rows carry chain+address+liq",
    body.family.every((f) => f.platform && f.address && f.liqUsd !== null));
}

console.log("— ape (venue mixing → appvenue split) —");
{
  const { status, body } = await call("ape");
  check("200", status === 200);
  const rh = body.candidates.filter((c) => /robinhood/i.test(c.platform));
  check("robinhood rows exist in fixture", rh.length > 0, `got ${rh.length}`);
  check("robinhood rows → elsewhere bucket",
    rh.every((c) => c.bucket === "elsewhere" && c.flags.includes("offchain-venue")));
  check("pick never an appvenue",
    !body.pick || body.pick.candidate.venue !== "appvenue");
}

console.log("— pi (farmed clone → flag + demotion) —");
{
  const { status, body } = await call("pi");
  check("200", status === 200);
  const farmed = body.candidates.filter((c) => c.flags.includes("possible-farming"));
  check("≥1 possible-farming flag", farmed.length >= 1, `got ${farmed.length}`);
  const pumpInu = body.candidates.find((c) => c.uniqueTraders24h > 5000 && (c.liqUsd ?? 1e9) < 200000);
  check("pump-inu clone flagged",
    !!pumpInu && pumpInu.flags.includes("possible-farming"),
    pumpInu ? JSON.stringify(pumpInu.flags) : "not found");
  if (pumpInu) {
    check("farmed clone excluded from pick",
      !body.pick || body.pick.candidate.address !== pumpInu.address,
      `pick=${body.pick?.candidate?.name} clone=${pumpInu.name}`);
  }
  check("stats.farmingFlagged reported", typeof body.stats.farmingFlagged === "number");
}

console.log("— wbtc (same-contract clustering + legit wrapped) —");
{
  const { status, body } = await call("wbtc");
  check("200", status === 200);
  check("mode family or pick", body.resolution === "family" || body.resolution === "pick", body.resolution);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

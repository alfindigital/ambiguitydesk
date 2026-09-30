# AGENTS.md — AmbiguityDesk

Project-local rules for AI sessions working in this folder. Master rules:
`C:\Users\GEEKOM A8\.agents\AGENTS.md` + `..\AGENTS.md` (workspace).

## Identity

Standalone sibling of `../verdex`. Same evidence discipline: **provider-reported
vs computed vs interpretation are never mixed**. Missing data renders as
`unknown`, never zero, never invented.

## Hard rules

1. **No secrets in files/git.** CMC key lives in `CMC_API_KEY` env (Cloudflare
   Pages secret for prod, `.env` untracked for local capture). Never print it.
2. **`dist/` is the only deployable.** Add new public files to the whitelist in
   `tools/build-dist.js` deliberately — docs and tools stay out.
3. **Heuristic honesty.** The `liq × ut24h` score is always labeled a heuristic.
   Never write "real token", "safe", or "scam" as a UI verdict. Prefer
   "strongest observed candidate" / "safest pick" with the caveat line.
4. **mcap is a flag, not a sort key** — it's inflatable (observed `mc=1e23`).
5. **Exact-symbol = case-insensitive + leading `$` stripped.** Dogwifhat is
   `$WIF` in CMC data; without this the canonical token loses to clones.
6. **Same-contract clustering must not imply legitimacy.** Bridged mirrors get
   a `same contract` chip and can't be the runner-up, but the UI never calls
   them "verified".
7. **Spot data only.** No margin/futures/leverage/lending features (workspace
   shariah rules).
8. **Verify before claiming done:** `node tools/test-resolve.mjs` must pass;
   visual changes need a browser screenshot, not just "it compiles".

## Test & ship checklist

```
node tools/test-resolve.mjs     # 26 assertions, offline
node tools/build-dist.js        # whitelist → dist/
wrangler pages dev dist         # click through: pepe, moodeng, unknown, mobile
wrangler pages deploy dist --project-name ambiguitydesk
```

Prod: https://ambiguitydesk.pages.dev · Set `CMC_API_KEY` Pages secret to flip
replay → live.

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/pages-AW1hek/functionsWorker-0.3730144568731605.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var CMC_BASE = "https://pro-api.coinmarketcap.com";
var QUERY_RE = /^[A-Za-z0-9$.:_-]{1,32}$/;
var MCAP_LIQ_FLAG_RATIO = 1e3;
var THIN_POOL_USD = 1e4;
var CLOSE_CALL_MARGIN = 3;
var FAMILY_MIN_CHAINS = 3;
var FAMILY_LIQ_USD = 1e5;
var FARMING_TRADERS_PER_100K = 40;
var YOUNG_POOL_DAYS = 30;
var YOUNG_PENALTY = 0.5;
var APP_VENUE_RE = /robinhood|coinbase|binance|kraken|bybit|bitget|kucoin|upbit|crypto\.com|revolut|etoro|paypal|venmo|cash\s*app|okx\b|mexc|gate\.io|bitstamp|bitfinex|gemini|htx|bithumb|bitflyer|lbank|bingx|bitmart|phemex|poloniex|bitvavo|wazirx|zebpay|coinDCX|indodax/i;
var classifyVenue = /* @__PURE__ */ __name2((plt) => APP_VENUE_RE.test(String(plt ?? "")) ? "appvenue" : "dex", "classifyVenue");
var json = /* @__PURE__ */ __name2((data, status = 200, extra = {}) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
}), "json");
var num = /* @__PURE__ */ __name2((v) => {
  if (v === void 0 || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, "num");
function clusterKey(address) {
  const a = String(address ?? "").trim().toLowerCase();
  const evm = a.match(/0x[a-f0-9]{40}/);
  if (evm) return evm[0];
  const m = a.match(/^(?:eth|evm|bsc|bnb|arb|base|poly|polygon|op|avax)-(.+?)(?:\.[a-z0-9_.-]+)?$/);
  return m ? m[1] : a;
}
__name(clusterKey, "clusterKey");
__name2(clusterKey, "clusterKey");
function normalizeRow(t) {
  return {
    platform: String(t.plt ?? "unknown"),
    address: String(t.addr ?? ""),
    name: String(t.n ?? ""),
    symbol: String(t.s ?? ""),
    liqUsd: num(t.liq),
    uniqueTraders24h: num(t.ut24h),
    mcapUsd: num(t.mc),
    priceChange24h: num(t.pc24h),
    vol24hUsd: num(t.v24h),
    logo: typeof t.l === "string" && t.l ? t.l : null,
    cmcId: num(t.cid),
    // First-pool-created timestamp — an un-fakeable age signal. A clone can
    // farm wallets but cannot make its pool born in April 2023.
    firstPoolMs: num(t.fpct) ?? num(t.fpt),
    venue: classifyVenue(t.plt)
  };
}
__name(normalizeRow, "normalizeRow");
__name2(normalizeRow, "normalizeRow");
function scoreOf(c) {
  if (c.liqUsd === null || c.uniqueTraders24h === null) return null;
  if (c.liqUsd <= 0 || c.uniqueTraders24h <= 0) return null;
  return c.liqUsd * c.uniqueTraders24h;
}
__name(scoreOf, "scoreOf");
__name2(scoreOf, "scoreOf");
function flagsOf(c, nowMs) {
  const flags2 = [];
  if (c.mcapUsd !== null && c.liqUsd !== null && c.liqUsd > 0 && c.mcapUsd / c.liqUsd > MCAP_LIQ_FLAG_RATIO) flags2.push("mcap-inflated");
  if (c.mcapUsd !== null && c.mcapUsd > 1e12) flags2.push("mcap-inflated");
  if (c.liqUsd !== null && c.liqUsd < THIN_POOL_USD) flags2.push("thin-pool");
  if (c.uniqueTraders24h === 0) flags2.push("no-traders");
  if (c.liqUsd === null || c.uniqueTraders24h === null) flags2.push("data-gap");
  if (c.liqUsd !== null && c.liqUsd > 0 && c.uniqueTraders24h !== null && c.uniqueTraders24h / (c.liqUsd / 1e5) > FARMING_TRADERS_PER_100K) flags2.push("possible-farming");
  if (c.firstPoolMs !== null && nowMs !== null && nowMs - c.firstPoolMs < YOUNG_POOL_DAYS * 864e5) flags2.push("young-pool");
  if (c.venue === "appvenue") flags2.push("offchain-venue");
  return [...new Set(flags2)];
}
__name(flagsOf, "flagsOf");
__name2(flagsOf, "flagsOf");
function fmtUsd(v) {
  if (v === null) return "unknown";
  if (v >= 1e15) return `$${v.toExponential(1)}`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
__name(fmtUsd, "fmtUsd");
__name2(fmtUsd, "fmtUsd");
function buildResult(query, rawRows, meta) {
  const rows = (Array.isArray(rawRows) ? rawRows : []).map(normalizeRow).filter((c) => c.address);
  const nowMs = meta?.capturedAt ? Date.parse(meta.capturedAt) : Date.now();
  const q = query.toLowerCase();
  const symNorm = /* @__PURE__ */ __name2((s) => s.toLowerCase().replace(/^\$/, ""), "symNorm");
  const exact = rows.filter((c) => symNorm(c.symbol) === q && c.venue === "dex");
  const related = rows.filter((c) => symNorm(c.symbol) !== q && c.venue === "dex");
  const elsewhere = rows.filter((c) => c.venue === "appvenue");
  const clusterOf = /* @__PURE__ */ new Map();
  let clusterSeq = 0;
  const keyToCluster = /* @__PURE__ */ new Map();
  for (const c of rows) {
    const k = clusterKey(c.address);
    if (!keyToCluster.has(k)) keyToCluster.set(k, `C${++clusterSeq}`);
    c.cluster = keyToCluster.get(k);
    const entry = clusterOf.get(c.cluster) ?? { id: c.cluster, platforms: [], addresses: /* @__PURE__ */ new Set() };
    entry.platforms.push(c.platform);
    entry.addresses.add(c.address);
    clusterOf.set(c.cluster, entry);
  }
  for (const c of rows) {
    c.score = scoreOf(c);
    c.flags = flagsOf(c, nowMs);
    c.effectiveScore = c.score === null ? null : c.score * (c.flags.includes("young-pool") ? YOUNG_PENALTY : 1);
    c.eligible = c.score !== null && c.venue !== "appvenue";
    c.bucket = c.venue === "appvenue" ? "elsewhere" : exact.includes(c) ? "exact" : "related";
  }
  const byScore = /* @__PURE__ */ __name2((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.liqUsd ?? -1) - (a.liqUsd ?? -1), "byScore");
  exact.sort(byScore);
  related.sort(byScore);
  elsewhere.sort(byScore);
  const cidGroups = /* @__PURE__ */ new Map();
  for (const c of exact) {
    if (c.cmcId === null || c.venue !== "dex") continue;
    const g = cidGroups.get(c.cmcId) ?? [];
    g.push(c);
    cidGroups.set(c.cmcId, g);
  }
  let family = null;
  for (const [cid, members] of cidGroups) {
    const fatChains = new Set(members.filter((c) => (c.liqUsd ?? 0) >= FAMILY_LIQ_USD).map((c) => c.platform));
    if (fatChains.size < FAMILY_MIN_CHAINS) continue;
    const perChain = /* @__PURE__ */ new Map();
    for (const c of members.filter((m) => fatChains.has(m.platform))) {
      const prev = perChain.get(c.platform);
      if (!prev || (c.effectiveScore ?? -1) > (prev.effectiveScore ?? -1)) perChain.set(c.platform, c);
    }
    family = [...perChain.values()].sort((a, b) => (b.effectiveScore ?? -1) - (a.effectiveScore ?? -1));
    break;
  }
  const pickBase = exact.length ? exact : rows;
  const pickDex = pickBase.filter((c) => c.venue === "dex");
  const unFarmed = pickDex.filter((c) => !c.flags.includes("possible-farming"));
  const pickPool = unFarmed.length ? unFarmed : pickDex;
  const pickAllFarmed = unFarmed.length === 0;
  let pick = null;
  const eligibleClusters = [...clusterOf.values()].map((cl) => {
    const members = pickPool.filter((c) => c.cluster === cl.id);
    const best = members.reduce((m, c) => c.effectiveScore !== null && (m === null || c.effectiveScore > m.effectiveScore) ? c : m, null);
    return best ? { cluster: cl, best, score: best.effectiveScore } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  if (eligibleClusters.length > 0) {
    const top = eligibleClusters[0];
    const runnerUp = eligibleClusters[1] ?? null;
    const marginX = runnerUp ? top.score / runnerUp.score : null;
    const label = runnerUp === null ? "only-candidate" : marginX >= CLOSE_CALL_MARGIN ? "clear-lead" : "close-call";
    const clusterNote = top.cluster.addresses.size > 1 ? ` Same contract also listed on ${top.cluster.platforms.slice(1).join(", ")}.` : "";
    const farmNote = pickAllFarmed ? " Every pickable candidate shows a farming signature \u2014 treat all of them as suspect." : "";
    const reason = runnerUp ? `${fmtUsd(top.best.liqUsd)} pool depth x ${top.best.uniqueTraders24h} unique traders, ${marginX.toFixed(1)}x the runner-up.${clusterNote} Heuristic, not proof.${farmNote}` : `Only candidate with both liquidity and trader data.${clusterNote} Heuristic, not proof.${farmNote}`;
    pick = { candidate: top.best, marginX, label, reason, runnerUp: runnerUp?.best ?? null };
  }
  const chains = new Set(rows.map((c) => c.platform));
  const farmingFlagged = rows.filter((c) => c.flags.includes("possible-farming")).length;
  return {
    ok: true,
    query,
    endpoint: "/v1/dex/search",
    ...meta,
    resolution: family ? "family" : "pick",
    family,
    stats: {
      totalRows: rows.length,
      exactCount: exact.length,
      relatedCount: related.length,
      elsewhereCount: elsewhere.length,
      farmingFlagged,
      chainCount: chains.size,
      clusterCount: clusterSeq
    },
    pick: family ? null : pick,
    candidates: [...exact, ...related, ...elsewhere]
  };
}
__name(buildResult, "buildResult");
__name2(buildResult, "buildResult");
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
__name2(sha256Hex, "sha256Hex");
async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get("q") ?? "").trim().replace(/^\$/, "");
  if (!raw || !QUERY_RE.test(raw)) {
    return json({ ok: false, error: "q must be a ticker or address (1-32 chars, letters/digits/$._:-)", query: raw }, 400);
  }
  const apiKey = context.env.CMC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${CMC_BASE}/v1/dex/search?q=${encodeURIComponent(raw)}`, {
        headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" }
      });
      const text = await res.text();
      if (!res.ok) return json({ ok: false, error: `cmc http ${res.status}`, query: raw }, 502);
      const body = JSON.parse(text);
      const sha = await sha256Hex(text);
      return json(buildResult(raw, body?.data?.tks ?? [], {
        mode: "live",
        capturedAt: (/* @__PURE__ */ new Date()).toISOString(),
        credits: body?.status?.credit_count ?? null,
        bodySha256: sha
      }));
    } catch (e) {
      return json({ ok: false, error: `upstream failure: ${e instanceof Error ? e.message : e}`, query: raw }, 502);
    }
  }
  const fixtureUrl = new URL(`/fixtures/${encodeURIComponent(raw.toUpperCase())}.json`, url.origin);
  const asset = await context.env.ASSETS.fetch(new Request(fixtureUrl));
  const ct = asset.headers.get("content-type") ?? "";
  let fixture = null;
  if (asset.ok && ct.includes("json")) {
    try {
      fixture = await asset.json();
    } catch {
      fixture = null;
    }
  }
  if (!fixture || !Array.isArray(fixture?.body?.data?.tks)) {
    return json({
      ok: false,
      error: "no live key configured and no committed fixture for this query",
      query: raw,
      fixturesNote: "replay covers only the committed example tickers"
    }, 404);
  }
  return json(buildResult(raw, fixture.body.data.tks, {
    mode: "replay",
    capturedAt: fixture.capturedAt ?? null,
    credits: fixture.credits ?? null,
    bodySha256: fixture.bodySha256 ?? null
  }));
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
var routes = [
  {
    routePath: "/api/resolve",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-RKZoOc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-RKZoOc/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.3730144568731605.js.map

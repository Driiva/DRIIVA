#!/usr/bin/env node
/**
 * Driiva's machine-checkable design laws, ported from the TradeMind harness
 * (web/tests/design-laws.mjs).
 *
 * Zero dependencies. It ATTACHES to the Chrome already running on :9222 per
 * CLAUDE.md (never launch a browser, never close one), opens its own tab,
 * measures, and closes only that tab.
 *
 * Usage:
 *   node tests/design-laws.mjs                     # the default routes
 *   node tests/design-laws.mjs http://host/page    # explicit routes
 *   PLANT_VIOLATION=1 node tests/design-laws.mjs   # prove the laws can fail
 *
 * Env: CDP_URL (default http://localhost:9222), DEV_URL (default
 * http://localhost:5173).
 *
 * THE LAWS
 *   1. No capsules. No painted OBLONG element carries a radius reaching half
 *      its short side. A SQUARE box at that radius is a circle - a dot, an
 *      avatar - and is deliberate, so the box is measured before judging.
 *   2. Colour comes from tokens. Every painted colour on the page resolves to
 *      one the design system defines. The palette is read from the LIVE
 *      computed tokens at run time, never pasted here, so retuning a token
 *      cannot quietly turn this law into a no-op.
 *   3. The retired palette renders nowhere. #8B5CF6 and #3B82F6 were the
 *      client's parallel purple/blue until Wave A. Retired means gone, not
 *      documented as retired beside a live copy.
 *   4. No em dashes in rendered copy. Also catches the double hyphen that
 *      people reach for instead.
 *   5. Type floors. Body copy >= 15px, secondary >= 13px, mono micro >= 11px.
 *   6. Every figure holds its columns: numeric readouts compute tabular-nums.
 *
 * Law 2 is the one that earns its keep. A hardcoded hex passes tsc, passes
 * eslint, passes review, and is invisible until someone retunes the brand and
 * one card does not move.
 */

const CDP = process.env.CDP_URL ?? 'http://localhost:9222';
const DEV = process.env.DEV_URL ?? 'http://localhost:5173';
const PLANT = process.env.PLANT_VIOLATION === '1';

const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [`${DEV}/`, `${DEV}/dashboard`, `${DEV}/trips`, `${DEV}/leaderboard`, `${DEV}/rewards`];

// ─────────────────────────────────────────────────────────────────────────────
// A minimal CDP client: open a tab, evaluate, close the tab.
// ─────────────────────────────────────────────────────────────────────────────

async function openTab(url) {
  const res = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`could not open a tab: ${res.status} ${await res.text()}`);
  return res.json();
}

async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`).catch(() => {});
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')), { once: true });
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

async function evaluate(client, expression) {
  const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
  return result.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// The planted violation. Proves the laws can fail: without this, a harness
// that silently matched nothing would report all green forever.
// ─────────────────────────────────────────────────────────────────────────────

const PLANT_SCRIPT = `(() => {
  const el = document.createElement("div");
  el.id = "planted-violation";
  el.textContent = "Planted capsule - retired purple - em dash \\u2014 here";
  el.style.cssText = [
    "position:fixed", "left:8px", "bottom:8px", "z-index:99999",
    "width:120px", "height:28px",
    "border-radius:9999px",
    "background:#8B5CF6",
    "color:#3B82F6",
    "font-size:9px",
  ].join(";");
  document.body.appendChild(el);
  return true;
})()`;

// ─────────────────────────────────────────────────────────────────────────────
// The checks, run inside the page.
// ─────────────────────────────────────────────────────────────────────────────

const CHECKS = `(() => {
  const out = [];
  const els = [...document.querySelectorAll("body *")];
  const own = (el) =>
    [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  // ── Law 1: no capsules. A radius at or past 999px on an OBLONG box is a
  // pill by any name. A SQUARE box at that radius is a circle - a status dot,
  // an avatar, a round icon button - and the design system uses those on
  // purpose, so the box is measured before the shape is judged.
  //
  // Measured against the BOX, not against 999px. A capsule is any oblong whose
  // radius reaches half its short side; border-radius:9999px is only the most
  // common way to write one. The first cut of this law tested the literal
  // 999px and passed the welcome screen's three CTAs, which are pills drawn
  // with a 28px radius on a 56px-tall button. A law that only catches one
  // spelling of the banned shape is a law the shape walks straight past.
  const RADII = ["borderTopLeftRadius","borderTopRightRadius","borderBottomLeftRadius","borderBottomRightRadius"];
  const capsules = els.filter((el) => {
    if (!seen(el)) return false;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - r.height) <= 1) return false;   // square => circle => allowed
    // A rule 4px or thinner is a line with rounded caps, not a capsule. The
    // ban is on the pill SHAPE - badges, chips, pill buttons - and flagging
    // every 2px progress bar would only teach people to ignore this law.
    const short = Math.min(r.width, r.height);
    if (short <= 4) return false;
    const s = getComputedStyle(el);
    // An element that paints nothing has no shape to judge. A transparent
    // 16x44 icon button carries a radius it never draws, and flagging those
    // was the law crying wolf.
    const paints =
      !/rgba\\(0, 0, 0, 0\\)|transparent/.test(s.backgroundColor) ||
      (parseFloat(s.borderTopWidth) > 0 && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(s.borderTopColor)) ||
      s.backgroundImage !== "none";
    if (!paints) return false;
    return RADII.some((k) => parseFloat(s[k]) >= short / 2 - 0.5);
  });
  out.push({
    law: "1 - no capsules: no painted oblong has a radius reaching half its short side (circles allowed)",
    pass: capsules.length === 0,
    detail: capsules.length
      ? capsules.slice(0, 5).map((el) => {
          const r = el.getBoundingClientRect();
          return (el.id || el.className || el.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height);
        }).join(" | ")
      : "no capsules found",
  });

  // ── Law 2: every painted colour resolves to a design token.
  //
  // The allowed set is read from the LIVE tokens, never pasted here. A copy of
  // the palette in this file would go stale the first time a token was retuned,
  // and the law would then pass a page painted entirely in the old colour.
  const TOKENS = [
    "--app-bg","--app-surface-1","--app-surface-2","--app-surface-3","--app-primary",
    "--app-text-hero","--app-text-pri","--app-text-sec","--app-text-mut",
    "--ink","--ink-1","--ink-2","--ink-3","--ink-4","--ink-5",
    "--brand-amber","--brand-burnt","--brand-violet","--brand-indigo",
    "--ok","--warn","--err","--teal",
  ];
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const triplet = (c) => {
    const m = String(c).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    return m ? m[1] + "," + m[2] + "," + m[3] : null;
  };
  const alpha = (c) => {
    const m = String(c).match(/rgba?\\([^)]*,\\s*([\\d.]+)\\s*\\)/);
    return m ? +m[1] : 1;
  };
  const allowed = new Set();
  const unresolved = [];
  for (const t of TOKENS) {
    probe.style.color = "";
    probe.style.color = "var(" + t + ")";
    const trip = triplet(getComputedStyle(probe).color);
    if (trip) allowed.add(trip); else unresolved.push(t);
  }
  probe.remove();

  // Compare the RGB TRIPLET, not the rgba string. A token used at partial
  // opacity is still that token: the hue has to come from the palette, the
  // alpha is a compositing choice. Matching full strings would have failed
  // every legitimate tinted surface in the app and taught everyone to ignore
  // this law, which is how a gate dies.
  //
  // Neutral machinery is not brand colour: any grey, white or black at any
  // alpha (hairlines, scrims, text tints), and anything fully transparent.
  const isNeutral = (c) => {
    const m = String(c).match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return true;
    if (alpha(c) === 0) return true;
    return m[1] === m[2] && m[2] === m[3];
  };

  const PAINT = ["color","backgroundColor","borderTopColor","borderBottomColor","borderLeftColor","borderRightColor"];
  const offPalette = [];
  for (const el of els) {
    if (!seen(el)) continue;
    const s = getComputedStyle(el);
    for (const prop of PAINT) {
      const c = s[prop];
      if (!c || isNeutral(c) || allowed.has(triplet(c))) continue;
      // A border colour only counts when there is a border to paint.
      if (prop.startsWith("border")) {
        const side = prop.replace("Color", "Width");
        if (parseFloat(s[side]) === 0) continue;
      }
      offPalette.push((el.id || el.className || el.tagName) + " " + prop + "=" + c);
    }

    // Gradients too. Reading only backgroundColor let a whole emerald gradient
    // CTA through this law: the stops live in backgroundImage, and a colour
    // smuggled in as a gradient stop is still a colour on the page.
    const bgi = s.backgroundImage;
    if (bgi && bgi !== "none") {
      for (const stop of bgi.match(/rgba?\\([^)]*\\)/g) ?? []) {
        if (isNeutral(stop) || allowed.has(triplet(stop))) continue;
        offPalette.push((el.id || el.className || el.tagName) + " gradient-stop=" + stop);
      }
    }
  }
  out.push({
    law: "2 - every painted colour resolves to a design token",
    pass: unresolved.length === 0 && offPalette.length === 0,
    detail: unresolved.length
      ? "COULD NOT RESOLVE " + unresolved.join(", ") + " - the check has nothing to assert with"
      : offPalette.length
        ? offPalette.length + " off-palette: " + offPalette.slice(0, 6).join(" | ")
        : allowed.size + " tokens resolved, no off-palette colour painted",
  });

  // ── Law 3: the retired parallel palette renders nowhere.
  //
  // Matched on the TRIPLET, at any alpha. The first cut of this law looked for
  // the solid rgb() form only, and passed a page still painting rgba(139, 92,
  // 246, 0.5) in a dozen glows: retuning a token moves everything except the
  // rgba() literals somebody pasted, which is exactly how a retired colour
  // survives a rename.
  const RETIRED = ["139, 92, 246", "59, 130, 246"];
  const stale = els.filter((el) => {
    if (!seen(el)) return false;
    const s = getComputedStyle(el);
    const painted = PAINT.map((p) => s[p]).concat([s.backgroundImage, s.boxShadow]).join(" ");
    return RETIRED.some((c) => painted.includes("(" + c) || painted.includes("(" + c.replace(/, /g, ",")));
  });
  out.push({
    law: "3 - the retired purple #8B5CF6 and blue #3B82F6 render nowhere",
    pass: stale.length === 0,
    detail: stale.length
      ? stale.slice(0, 5).map((el) => el.id || el.className || el.tagName).join(" | ")
      : "no element carries the retired palette",
  });

  // ── Law 4: no em dashes in rendered copy, and no double hyphen either.
  const offenders = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent || "";
    if (/\\u2014|\\u2013|--/.test(t)) {
      const parent = n.parentElement;
      if (parent && parent.closest("script, style")) continue;
      offenders.push(t.trim().slice(0, 60));
    }
  }
  out.push({
    law: "4 - no em dashes, en dashes or double hyphens in rendered copy",
    pass: offenders.length === 0,
    detail: offenders.length ? offenders.slice(0, 5).join(" | ") : "copy is clean",
  });

  // ── Law 5: the type floors.
  const isFigure = (t) => /^[£$]?\\s?-?[\\d][\\d,.:%]*\\s?[a-z]{0,3}$/.test(t) && /\\d/.test(t);
  const isMono = (el) => /mono/i.test(getComputedStyle(el).fontFamily.replace(/_/g, " "));
  const size = (el) => parseFloat(getComputedStyle(el).fontSize);
  const prose = els.filter((el) => seen(el) && own(el).length >= 12 && !isFigure(own(el)));
  const body = prose.filter((el) => !isMono(el) && own(el).length >= 60);
  const secondary = prose.filter((el) => !isMono(el) && own(el).length < 60);
  const micro = prose.filter(isMono);
  const under = [
    ...body.filter((el) => size(el) < 15).map((el) => ["body 15px", el]),
    ...secondary.filter((el) => size(el) < 13).map((el) => ["secondary 13px", el]),
    ...micro.filter((el) => size(el) < 11).map((el) => ["mono micro 11px", el]),
  ];
  out.push({
    law: "5 - type floors: body >= 15px, secondary >= 13px, mono micro >= 11px",
    pass: prose.length > 0 && under.length === 0,
    detail: prose.length === 0
      ? "NO PROSE FOUND - the check found nothing to assert on"
      : under.length
        ? under.slice(0, 5).map(([floor, el]) =>
            floor + " breached at " + size(el) + 'px: "' + own(el).slice(0, 40) + '"').join(" | ")
        : body.length + " body / " + secondary.length + " secondary / " + micro.length + " micro, all above floor",
  });

  // ── Law 6: figures hold their columns.
  const figures = els.filter((el) => seen(el) && isFigure(own(el)));
  const jittery = figures.filter((el) => {
    const s = getComputedStyle(el);
    return !/tabular-nums/.test(s.fontVariantNumeric) && !/tnum/.test(s.fontFeatureSettings);
  });
  out.push({
    law: "6 - every numeric readout computes tabular figures",
    pass: figures.length === 0 || jittery.length === 0,
    detail: figures.length === 0
      ? "no figures on this route"
      : jittery.length
        ? jittery.slice(0, 5).map((el) => own(el) + " -> " + (el.className || el.tagName)).join(" | ")
        : figures.length + " figures, all tabular",
  });

  return out;
})()`;

// ─────────────────────────────────────────────────────────────────────────────

async function check(url) {
  const tab = await openTab(url);
  const client = connect(tab.webSocketDebuggerUrl);
  try {
    await client.ready;
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Page.navigate', { url });
    await evaluate(
      client,
      `new Promise((r) => {
         const done = () => document.fonts.ready.then(() => setTimeout(r, 400));
         if (document.readyState === "complete") done();
         else addEventListener("load", done, { once: true });
       })`,
    );
    const rendered = await evaluate(client, 'document.body.children.length > 0');
    if (!rendered) throw new Error(`nothing rendered at ${url}`);
    if (PLANT) await evaluate(client, PLANT_SCRIPT);
    return await evaluate(client, CHECKS);
  } finally {
    client.close();
    await closeTab(tab.id);
  }
}

let failed = false;

// Fail loudly rather than silently when Chrome is not listening: a harness
// that cannot reach the browser must never report green.
try {
  const res = await fetch(`${CDP}/json/version`);
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.log(`ERROR no Chrome on ${CDP}. Relaunch it with --remote-debugging-port=9222.`);
  process.exit(2);
}

if (PLANT) console.log('PLANT_VIOLATION=1: a capsule in the retired purple is being injected.\n');

// A route that redirects on load (signin bouncing an authenticated session)
// can close the tab mid-evaluate. One retry, because a gate that fails at
// random gets switched off within a week.
async function checkWithRetry(url) {
  try {
    return await check(url);
  } catch (error) {
    if (!/navigated or closed/i.test(error.message)) throw error;
    return check(url);
  }
}

for (const url of TARGETS) {
  console.log(`\n-- ${url}`);
  try {
    const results = await checkWithRetry(url);
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  law ${r.law}\n        ${r.detail}`);
      if (!r.pass) failed = true;
    }
  } catch (error) {
    console.log(`ERROR ${error.message}`);
    failed = true;
  }
}

if (PLANT) {
  console.log(
    failed
      ? '\nPLANT CHECK: the laws caught the planted violation. The gate works.'
      : '\nPLANT CHECK FAILED: the planted violation went undetected. The gate is a no-op.',
  );
  process.exit(failed ? 0 : 1);
}

console.log(failed ? '\nDESIGN LAWS: FAILED' : '\nDESIGN LAWS: ALL GREEN');
process.exit(failed ? 1 : 0);

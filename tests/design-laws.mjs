#!/usr/bin/env node
/**
 * Driiva's machine-checkable design laws, ported from the TradeMind harness
 * (web/tests/design-laws.mjs).
 *
 * Zero dependencies. It ATTACHES to the Chrome already running on :9222 per
 * CLAUDE.md (never launch a browser, never close one), opens its own tab,
 * measures, and closes only that tab.
 *
 * HOW IT REACHES THE AUTHENTICATED SURFACES, and why that changed.
 * Four of the five routes it walks are behind ProtectedRoute. This harness
 * used to reach them by writing sessionStorage['driiva-demo-mode'] = 'true',
 * which ProtectedRoute honours by rendering children unconditionally. That had
 * two consequences, both bad. When the write landed it was auditing DEMO MODE:
 * the fabricated pool, the invented participants, three trips that never
 * happened. When it did not land in time, the route bounced to /signin and the
 * run errored. So the harness alternated between measuring a fixture and
 * measuring nothing, and neither was the product.
 *
 * It now signs in as the seeded emulator driver through the app's own form,
 * the same way the accessibility audit does, via tests/qa-session.mjs. The
 * surfaces it measures are the real ones, rendering real seeded data through
 * their real auth paths.
 *
 * Usage:
 *   node tests/design-laws.mjs                     # the default routes
 *   node tests/design-laws.mjs /trips /rewards     # named routes
 *   node tests/design-laws.mjs http://host/page    # explicit URLs
 *   PLANT_VIOLATION=1 node tests/design-laws.mjs   # prove the laws can fail
 *   --allow-unreached                              # do not fail on skips
 *
 * Env: CDP_URL (default http://localhost:9222), DEV_URL / APP_URL (default
 * http://localhost:5173). Needs the QA emulator and seed:
 *   npm run qa:emulators   (one terminal)
 *   npm run qa:seed        (once)
 *   then the dev server with VITE_USE_FIREBASE_EMULATOR=true
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
const DEV = process.env.DEV_URL ?? process.env.APP_URL ?? 'http://localhost:5173';
const PLANT = process.env.PLANT_VIOLATION === '1';

/*
 * The CDP plumbing and the sign-in flow live in tests/qa-session.mjs, shared
 * with the accessibility audit. This file used to carry its own copy of
 * openTab/connect/evaluate, which is two implementations of one thing waiting
 * to disagree.
 *
 * The import is dynamic because qa-session reads APP_URL when the module is
 * evaluated, and this harness has always been driven by DEV_URL. Setting it
 * first keeps one base URL for both rather than a second env var to remember.
 */
process.env.APP_URL ??= DEV;
const {
  evaluate, settle, signedInIsolatedTab, goto, incognitoTab,
} = await import('./qa-session.mjs');

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
  /*
   * Inside #root, because that is where the laws look.
   *
   * This appended to document.body, and when the laws were scoped to #root to
   * stop a Recharts scratch node failing law 6, the plant silently fell
   * outside the element set FOUR of the six laws examine. The plant check
   * still printed "the gate works", because law 4 reads body text and fired on
   * its own. A plant that only proves one law is alive is a plant that lets
   * the other five rot.
   */
  (document.getElementById("root") || document.body).appendChild(el);
  return true;
})()`;

/**
 * The laws the plant is BUILT to trip: a capsule radius on an oblong (1), the
 * retired purple as a background and the retired blue as a colour (2 and 3),
 * an em dash in its text (4), and 9px type (5).
 *
 * Checking these by name rather than counting any failure is the difference
 * between a plant that proves the gate works and one that proves something
 * somewhere failed. Law 6 is excluded: the plant carries no figure, so it
 * cannot speak to that law and pretending otherwise would be its own lie.
 */
const PLANT_TARGET_LAWS = ['1', '2', '3', '4', '5'];

// ─────────────────────────────────────────────────────────────────────────────
// The checks, run inside the page.
// ─────────────────────────────────────────────────────────────────────────────

const CHECKS = `(() => {
  const out = [];
  /*
   * OUR markup only.
   *
   * The laws describe Driiva's rendered UI, and things that are not Driiva's
   * rendered UI get appended to <body> all the time: browser extensions (this
   * Chrome profile carries Adobe Acrobat, which the accessibility audit
   * already excludes by selector), and library scratch nodes. Recharts appends
   * a hidden #recharts_measurement_span to <body> to measure text, and the
   * moment this harness could actually reach the charted routes, law 6 began
   * failing /leaderboard and /rewards on that span: a figure nobody can see,
   * in markup we do not own and cannot change.
   *
   * A gate that reports a library's internals as a brand violation gets
   * switched off within a week, which is the same way a gate dies as one that
   * never arrives. The app mounts at #root, so that is the boundary.
   */
  const root = document.getElementById("root");
  const els = root ? [...root.querySelectorAll("*")] : [];
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
    // The accent as text on dark. Added when the axe audit showed --app-primary
    // at 3.3:1 as small text; law 2 correctly flagged the new colour until it
    // was registered here, which is the law working rather than an exception.
    "--app-primary-text",
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

/**
 * The product's own demo mode, entered the way the product enters it.
 *
 * Every routed surface worth linting sits behind auth, so without this the
 * harness could only ever measure /signin. These are the exact two session
 * keys client/src/pages/demo.tsx writes; AuthContext reads them and serves a
 * demo profile with no Firebase call.
 */
/**
 * Runs the laws against whatever the client is currently showing.
 *
 * Throws when the route under test is not the route on screen. A gate that
 * reports on a page it never reached is worse than no gate, because it is
 * believed: this harness once walked four authenticated routes, watched every
 * one bounce to /signin, and printed ALL GREEN having measured the sign-in
 * page four times.
 */
async function measure(client, route, { plant = false } = {}) {
  await settle(client);

  const rendered = await evaluate(
    client,
    '(document.getElementById("root")?.children.length ?? 0) > 0',
  );
  if (!rendered) throw new Error('nothing rendered');

  const landed = await evaluate(client, 'location.pathname');
  if (landed !== route) {
    throw new Error(`redirected to ${landed}`);
  }

  if (plant) await evaluate(client, PLANT_SCRIPT);
  return evaluate(client, CHECKS);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RUNNER
//
// Three outcomes, reported as three different things, because they mean three
// different things and a reader scanning a log has to be able to tell them
// apart:
//
//   CLEAN        the laws ran on this route and found nothing
//   FAILING      the laws ran on this route and found something
//   NOT REACHED  the laws never ran here at all
//
// The third used to be indistinguishable from the first at a glance. That is
// the exact shape of every bug this codebase has spent a fortnight finding: a
// confident green from a check that never arrived. NOT REACHED fails the run
// unless --allow-unreached is passed, and either way it is named in the
// summary rather than left for someone to spot in the scrollback.
// ─────────────────────────────────────────────────────────────────────────────

const ALLOW_UNREACHED = process.argv.includes('--allow-unreached');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));

/** Routes that render without a session. */
const PUBLIC_ROUTES = ['/'];
/** Routes behind ProtectedRoute, reached with the seeded sign-in. */
const PRIVATE_ROUTES = ['/dashboard', '/trips', '/leaderboard', '/rewards'];

const requested = args.map((a) => (a.startsWith('http') ? new URL(a).pathname : a));
const publicTargets = requested.length
  ? requested.filter((r) => PUBLIC_ROUTES.includes(r))
  : PUBLIC_ROUTES;
const privateTargets = requested.length
  ? requested.filter((r) => !PUBLIC_ROUTES.includes(r))
  : PRIVATE_ROUTES;

// Fail loudly rather than silently when Chrome is not listening: a harness
// that cannot reach the browser must never report green.
try {
  const res = await fetch(`${CDP}/json/version`);
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.log(`ERROR no Chrome on ${CDP}. Relaunch it with --remote-debugging-port=9222.`);
  process.exit(2);
}

// Same refusal for the app itself. When the dev server went down mid-session
// every route quietly became chrome-error://chromewebdata and the audit
// scored an error page.
try {
  const probe = await fetch(DEV, { redirect: 'manual' });
  if (!probe.ok && probe.status !== 304) throw new Error(`status ${probe.status}`);
} catch (err) {
  console.log(`ERROR cannot reach the app at ${DEV}: ${err.message}`);
  process.exit(2);
}

if (PLANT) console.log('PLANT_VIOLATION=1: a capsule in the retired purple is being injected.\n');

const outcomes = [];
let planted = false;

function record(route, state, laws, reason) {
  outcomes.push({ route, state, laws: laws ?? [], reason });
  if (state === 'notReached') {
    console.log(`\nNOT REACHED  ${route}\n        ${reason}`);
    return;
  }
  console.log(`\n${state === 'clean' ? 'CLEAN' : 'FAILING'}  ${route}`);
  for (const r of laws) {
    console.log(`  ${r.pass ? 'pass' : 'FAIL'}  law ${r.law}\n        ${r.detail}`);
  }
}

/** Runs the laws on one route and classifies the result. */
function classify(route, laws) {
  const broken = laws.filter((r) => !r.pass);
  record(route, broken.length ? 'failing' : 'clean', laws);
}

// ── Public routes: an isolated context, which also proves they do not
// silently depend on a session. A stale one turns "/" into the dashboard.
for (const route of publicTargets) {
  const session = await incognitoTab(`${DEV}${route}`);
  try {
    const laws = await measure(session.client, route, { plant: PLANT && !planted });
    if (PLANT) planted = true;
    classify(route, laws);
  } catch (error) {
    record(route, 'notReached', [], error.message);
  } finally {
    await session.dispose();
  }
}

// ── Private routes: one signed-in tab, navigated through the SPA router.
if (privateTargets.length) {
  let session = null;
  try {
    session = await signedInIsolatedTab();
  } catch (error) {
    for (const route of privateTargets) {
      record(route, 'notReached', [], `could not sign in: ${error.message}`);
    }
  }

  if (session) {
    const { client, signedIn, reachedDashboard } = session;
    // Two conditions, not one. `signedIn === 'ok'` says the form was submitted
    // and the route left /signin; `reachedDashboard` says ProtectedRoute
    // actually let us in once auth had finished enriching. Trusting the first
    // alone is how a run gets as far as /quick-onboarding and then reports on
    // whatever that renders.
    if (signedIn !== 'ok' || !reachedDashboard) {
      const why = signedIn !== 'ok'
        ? `sign-in did not complete: ${signedIn}`
        : 'signed in but ProtectedRoute did not admit us to /dashboard';
      for (const route of privateTargets) record(route, 'notReached', [], why);
    } else {
      for (const route of privateTargets) {
        try {
          await goto(client, route);
          const laws = await measure(client, route, { plant: PLANT && !planted });
          if (PLANT) planted = true;
          classify(route, laws);
        } catch (error) {
          record(route, 'notReached', [], error.message);
        }
      }
    }
    await session.dispose();
  }
}

// ─── SUMMARY ────────────────────────────────────────────────────────────────

const clean = outcomes.filter((o) => o.state === 'clean');
const failing = outcomes.filter((o) => o.state === 'failing');
const notReached = outcomes.filter((o) => o.state === 'notReached');

console.log('\n' + '-'.repeat(70));
console.log(
  `COVERAGE  ${clean.length + failing.length} of ${outcomes.length} routes measured` +
    (notReached.length ? `, ${notReached.length} NOT REACHED` : ''),
);
console.log(`  clean       ${clean.length}${clean.length ? '  ' + clean.map((o) => o.route).join(' ') : ''}`);
console.log(`  failing     ${failing.length}${failing.length ? '  ' + failing.map((o) => o.route).join(' ') : ''}`);
console.log(`  not reached ${notReached.length}${notReached.length ? '  ' + notReached.map((o) => o.route).join(' ') : ''}`);

if (PLANT) {
  const measured = outcomes.filter((o) => o.state !== 'notReached');
  const tripped = new Set(
    measured.flatMap((o) => o.laws.filter((r) => !r.pass).map((r) => String(r.law).split(' ')[0])),
  );
  const missed = PLANT_TARGET_LAWS.filter((law) => !tripped.has(law));

  if (!measured.length) {
    console.log('\nPLANT CHECK FAILED: no route was reached, so nothing was proven.');
    process.exit(1);
  }
  if (missed.length) {
    console.log(
      `\nPLANT CHECK FAILED: the plant went undetected by law(s) ${missed.join(', ')}. ` +
        'Those laws are not looking where the plant landed, so they are no-ops.',
    );
    process.exit(1);
  }
  console.log(
    `\nPLANT CHECK: laws ${PLANT_TARGET_LAWS.join(', ')} all caught the planted violation. The gate works.`,
  );
  process.exit(0);
}

if (failing.length) {
  console.log('\nDESIGN LAWS: FAILED, laws broken on ' + failing.length + ' route(s)');
  process.exit(1);
}
if (notReached.length && !ALLOW_UNREACHED) {
  console.log(
    '\nDESIGN LAWS: INCOMPLETE. No law was broken, but ' + notReached.length +
      ' route(s) were never measured, so this is not a pass.\n' +
      'Start the QA emulator and seed it (npm run qa:emulators, npm run qa:seed) and run the\n' +
      'dev server with VITE_USE_FIREBASE_EMULATOR=true, or pass --allow-unreached to accept the gap.',
  );
  process.exit(1);
}

console.log(
  notReached.length
    ? `\nDESIGN LAWS: ALL GREEN on ${clean.length} route(s), ${notReached.length} skipped by request`
    : `\nDESIGN LAWS: ALL GREEN on all ${clean.length} route(s)`,
);
process.exit(0);

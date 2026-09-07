/**
 * The checks, run inside the page. This is one string because it is evaluated
 * in the browser through CDP, not imported there. Extracted verbatim from
 * tests/design-laws.mjs.
 */

export const CHECKS = `(() => {
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

#!/usr/bin/env node
/**
 * Fabrication laws for the WEB surfaces.
 *
 * Wave 0 swept this repo for invented data by grepping literals somebody had
 * already named: DEEP_INSIGHTS, "117", a list of fake first names. That finds
 * the lies you have already found. It walked straight past a fabricated
 * leaderboard on the first screen of mobile onboarding, a downloadable policy
 * document carrying an invented FCA registration number, and a marketing site
 * reporting the community pool as 68% funded.
 *
 * So this does not grep for known lies. It greps for the SHAPES a lie takes in
 * an insurtech that has not launched, and then requires every single hit to be
 * signed off by name in ALLOWED below. New hits fail; they do not have to be
 * false, they have to be ACKNOWLEDGED. That is the difference between a lint
 * that finds yesterday's problem and one that catches tomorrow's.
 *
 * STYLESHEETS COUNT AS SOURCE. This originally read .ts and .tsx only, and the
 * same invented waitlist figure got onto the screen three times by three routes,
 * each found by a different method and never by the previous sweep: hardcoded in
 * a component, padded at source in an env default, and finally printed straight
 * out of a stylesheet as
 *     .sticky-cta-inner::before { content: '117+ on the list'; }
 * shown to every reader under 560px while the true count was zero. A lint that
 * reads components and not the CSS beside them does not cover the surface, it
 * covers the half of it people think to look at. CSS can put words on a page
 * three ways and all three are linted here: a `content` string, `content:
 * attr()` pulling an attribute onto the screen, and text baked into an inline
 * SVG data URI.
 *
 * Usage:
 *   node tests/fabrication-laws.mjs                    # lint
 *   PLANT_VIOLATION=1 node tests/fabrication-laws.mjs  # prove it can fail
 *
 * Adding an allowlist entry is the intended workflow, not a defeat. It costs
 * one line and a reason, and the reason is the point: it forces someone to
 * write down why a number about money or a claim about regulation is true.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

function repoRoot() {
  try {
    const here = new URL('..', import.meta.url);
    if (here.protocol === 'file:') return fileURLToPath(here);
  } catch {
    // fall through to cwd
  }
  return process.cwd();
}

const ROOT = repoRoot();
// `apps/marketing/public` is here because llms.txt and robots.txt are copy too.
// A machine-readable summary written FOR AI systems is the one file guaranteed
// to be read and repeated verbatim by something that cannot check it, so an
// invented regulatory position there travels further than the same sentence in
// a component. It sat outside this lint until 10 Aug 2026 purely because it is
// not .tsx.
// `mobile/app` and `mobile/components` are here because the law could not see
// them until 26 Aug 2026, and that is where the damage was. Of the eight files
// still claiming "pending FCA authorisation" sixteen days after the sweep that
// was meant to have removed it, SEVEN were mobile screens. Widening the regex
// alone would have caught exactly one of the eight. A guard that reads two of
// the three surfaces does not cover the product, it covers the part somebody
// remembered to point it at, and the mobile app is the surface a user actually
// signs up through.
const DIRS = [
  'client/src',
  'apps/marketing/src',
  'apps/marketing/api',
  'apps/marketing/public',
  'server',
  'functions/src',
  'mobile/app',
  'mobile/components',
];
const SKIP = /node_modules|__tests__|\.test\.|\.spec\.|__snapshots__/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(tsx?|css|txt|md)$/.test(entry) && !SKIP.test(full)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * Resolve CSS escapes so a decorative glyph is not mistaken for copy.
 * `\2014` is an em dash, not the number 2014, and there are a lot more
 * pseudo-element bullets in a stylesheet than there are sentences.
 */
function decodeCssString(raw) {
  return raw
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\(.)/g, '$1');
}

/**
 * Pull every `content` declaration out of a stylesheet.
 *
 * Anchored on a property boundary on purpose: `justify-content` and
 * `align-content` are the two commonest declarations in this codebase and a
 * bare /content:/ matches the tail of both, which would bury the real hits
 * under 28 false ones and get the law switched off within a week.
 */
function extractContentDeclarations(source) {
  const out = [];
  const decl = /(^|[;{}\s])content\s*:\s*([^;}]+)/g;
  for (const m of source.matchAll(decl)) {
    const value = m[2];
    const valueAt = m.index + m[0].length - value.length;

    // attr() renders whatever an attribute holds, which is copy arriving on
    // screen by a route none of the source laws are reading.
    for (const a of value.matchAll(/attr\(\s*([^)]+?)\s*\)/g)) {
      out.push({ index: valueAt + a.index, text: `attr(${a[1]})` });
    }

    for (const s of value.matchAll(/(['"])((?:\\.|(?!\1).)*)\1/g)) {
      const decoded = decodeCssString(s[2]);
      // Two or more consecutive letters, or two or more consecutive digits.
      // A lone glyph, a separator, an empty string or a single counter suffix
      // is furniture; words and figures are the page talking to someone.
      if (!/\p{L}{2,}|\d{2,}/u.test(decoded)) continue;
      out.push({ index: valueAt + s.index, text: decoded });
    }
  }
  return out;
}

/**
 * The shapes. Each is deliberately broad: a false positive costs one allowlist
 * line, a false negative costs a regulatory incident.
 */
const LAWS = [
  {
    /*
     * This law was a list of spellings, and a paraphrase walked past it.
     *
     * It matched `FCA-authorised`, `FCA-regulated`, `FCA-supervised`. Eight
     * files said "our insurance product is pending FCA authorisation" and not
     * one of them tripped it, because "authorisation" is not "authorised".
     * The regex never fired, so the reconciliation of 10 Aug looked like it
     * held for sixteen days while four screens had already been reverted and
     * four more had never been in scope.
     *
     * Adding `pending FCA` to the list would fix those eight and miss the
     * ninth. "Awaiting FCA sign-off", "our FCA application", "FCA approval in
     * progress" are all the same claim wearing different words, and a guard
     * that enumerates the failures it has already seen only ever catches the
     * failure it has already seen.
     *
     * So this matches the SHAPE instead: the letters FCA within a short span
     * of any word that asserts a position in front of it, in either order.
     * That deliberately fires on the TRUE sentences too, including the agreed
     * one, and every one of them is signed off by name in ALLOWED with the
     * reason it is true. A false positive costs one allowlist line. A false
     * negative costs a regulatory incident, and just did.
     */
    id: 'regulatory-claim',
    title: 'Claims about regulated status, underwriting or capacity',
    pattern: new RegExp(
      [
        // FCA, then a status word close behind it.
        String.raw`\bFCA\b[^.\n]{0,40}?\b(authoris\w+|approv\w+|regulat\w+|supervis\w+|registr\w+|licen[cs]\w+|permission\w*|sandbox|application|sign[- ]off)\b`,
        // A status word, then FCA close behind it. Catches "pending FCA
        // authorisation" from the other end, and "applied to the FCA".
        String.raw`\b(pending|awaiting|await\w+|applied|applying|application|submitted|in review|under review|approved|authoris\w+|registered|licen[cs]\w+)\b[^.\n]{0,40}?\bFCA\b`,
        // The claims that never mention the FCA by name.
        String.raw`authorised and regulated`,
        String.raw`we are authorised`,
        String.raw`regulated by the Financial Conduct`,
        String.raw`PRA[- ]regulated`,
        String.raw`underwritten by`,
        String.raw`capacity partner`,
        String.raw`reinsur\w*`,
        String.raw`registration number`,
      ].join('|'),
      'gi',
    ),
  },
  {
    id: 'invented-scale',
    title: 'Claims about how many people already use this',
    pattern:
      /thousands of (drivers|members|users|people)|hundreds of (drivers|members|users)|join \d[\d,]* |trusted by|\d[\d,]* (drivers|members|users) (already|have|are)|top \d+% of drivers/gi,
  },
  {
    id: 'settled-money',
    title: 'Claims that money has moved or will move',
    pattern:
      /refunds? (tracked|paid|processing|processed)|paid (out )?(within|in) \d+ (days|weeks)|claims? (is|are) paid|you (will|'ll) (get|receive) £|already (paid|refunded)/gi,
  },
  {
    id: 'placeholder-identity',
    title: 'Placeholder people, contacts and addresses that can reach a user',
    pattern:
      /Test Driver|John Doe|Jane Doe|lorem ipsum|example\.com|test@[a-z]|\b0800 ?\d{3} ?\d{4}\b|DRV\d{6}/gi,
  },
  {
    /*
     * WAVE H taught this one. Three separate places asserted a state nobody
     * had checked, all with the same shape: a value we did not have, replaced
     * by a plausible one. `status: 'active'` written whatever the insurer
     * said. `policy_number || DRV-${Date.now()}`. A safety factor defaulting
     * to 1.0 and rendering as "100%". A name falling back to "Driver Unknown"
     * on an insurance record.
     *
     * The tell is a fallback operator supplying a CONFIDENT value for
     * something only an external system can answer. A null or an empty state
     * is fine; a confident stand-in is the bug.
     */
    id: 'invented-fallback',
    title: 'A confident stand-in for something only an insurer or a person can tell us',
    pattern:
      /(\|\||\?\?)\s*['"`](active|confirmed|approved|bound|Unknown|Test Driver)['"`]|(\|\||\?\?)\s*`?DRV-|(\|\||\?\?)\s*1\.0\s*[,;)]/g,
  },
  {
    id: 'money-literal',
    title: 'A pounds figure written into a rendered surface',
    // Components and stylesheets only: a literal in a .ts helper is usually
    // maths, a literal in a component or a content string is a number
    // somebody reads.
    pattern: /£\s?\d[\d,]*(\.\d+)?\s?[kKmM]?/g,
    filesOnly: /\.(tsx|css)$/,
  },
  {
    id: 'stylesheet-copy',
    title: 'A stylesheet printing words or figures onto the page',
    // Any readable string in a `content` declaration. Not every hit is a lie:
    // a responsive column label is legitimate. But a stylesheet is the one
    // place copy can be written with no component, no prop and no data source
    // behind it, so it does not get to state anything unacknowledged.
    filesOnly: /\.css$/,
    extract: extractContentDeclarations,
  },
  {
    id: 'stylesheet-image-copy',
    title: 'Text baked into an inline SVG background image',
    // A data URI is a rendering surface that reads as a URL. Words inside one
    // are invisible to every text search anybody thinks to run.
    filesOnly: /\.css$/,
    pattern: /url\(\s*["']?data:image\/svg\+xml[^)]*?(?:<text|%3Ctext)[^)]*\)/gi,
  },
];

/**
 * Every acknowledged hit, keyed "<file>::<matched text lowercased>".
 * A reason is mandatory. "It is fine" is not a reason.
 */
const ALLOWED = new Map(Object.entries({
  // ── llms.txt: the regulatory words appear only inside their own denial
  'apps/marketing/public/llms.txt::fca authorised':
    'Every occurrence is a negation. Line 3 "is not FCA authorised", line 10 "Not FCA authorised", line 54 the explicit do-not-say list telling AI systems never to claim it.',
  'apps/marketing/public/llms.txt::fca regulated':
    'Line 54 only, inside "Do not say: that Driiva is FCA authorised, FCA regulated, FCA registered...". The file exists to stop a model asserting this.',
  'apps/marketing/public/llms.txt::registration number':
    'Line 54, instructing AI systems NOT to attribute a company registration number to Driiva from memory. Written because a downloadable policy document once carried the invented number DRV123456.',

  // ── Regulatory language that is correctly conditional or correctly negative
  'client/src/pages/trust.tsx::underwritten by':
    'Future tense: "they will be underwritten by a regulated capacity partner", followed by "No capacity partner is in place today".',
  'client/src/pages/trust.tsx::capacity partner':
    'Same sentence; the page states plainly that there is not one yet.',
  'apps/marketing/src/sections/Footer.tsx::pra-regulated':
    'Fine print, conditional: capital backing "once underwriting begins". This is the wording the rest of the site was aligned TO.',
  'apps/marketing/src/sections/Footer.tsx::underwriting':
    'Same sentence.',
  'apps/marketing/src/sections/Security.tsx::pra-regulated':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/Security.tsx::reinsurance':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/Security.tsx::underwriting':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/TrustRibbon.tsx::pra-regulated':
    'Badge reads "Reinsurance backed / PRA-regulated capital at launch". At launch, not today.',
  'apps/marketing/src/sections/FAQ.tsx::fca-regulated':
    'The question "Are you FCA-regulated?". The answer begins "Not yet."',
  'apps/marketing/src/sections/FAQ.tsx::pra-regulated':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/FAQ.tsx::reinsurer':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/FAQ.tsx::underwriting':
    'Conditional, matches the footer.',
  'apps/marketing/src/routes/Terms.tsx::we are authorised':
    'Legal page, conditional: "When we are authorised to do so by the FCA".',
  'apps/marketing/src/routes/Terms.tsx::underwriting':
    'Legal page: offers "may be subject to underwriting". Conditional.',
  'apps/marketing/src/routes/Complaints.tsx::we are authorised':
    'Legal page, conditional: "once we are authorised".',
  'apps/marketing/src/routes/Complaints.tsx::fca-authorised':
    'Legal page, conditional: "Until we are FCA-authorised, the FOS route is not yet available".',
  'apps/marketing/src/routes/Privacy.tsx::underwriting':
    'Legal page: "begins underwriting real policies (post FCA Sandbox)". Conditional.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca-authorised':
    'Conditional, and the honest-framing exemplar: "Real pricing happens once we are FCA-authorised".',
  'client/src/pages/profile.tsx::fca-authorised':
    'Empty state: "Driiva cannot issue policies until it is FCA-authorised".',
  'apps/marketing/src/sections/Comparison.tsx::fca-aligned':
    'Aspirational positioning, not a status claim.',
  'apps/marketing/src/sections/Footer.tsx::reinsurer':
    'Same conditional sentence as ::pra-regulated above.',
  'apps/marketing/src/sections/Security.tsx::reinsurer':
    'Same conditional sentence.',
  'apps/marketing/src/sections/TrustRibbon.tsx::reinsurance':
    'Badge label "Reinsurance backed", qualified by "at launch" on the line below.',
  'apps/marketing/src/sections/Pool.tsx::fca-authorised':
    'The illustration label: "Nothing is paid until we are FCA-authorised".',
  'client/src/pages/policy.tsx::fca-authorised':
    'Two honest empty states: cover "cannot issue one until it is FCA-authorised", and refunds "not paid until Driiva is FCA-authorised".',

  // ── The agreed status line, and the sentences that qualify it.
  //
  // These are all hits on the broadened shape above, and they are all TRUE.
  // The agreed wording is "working towards the FCA regulatory sandbox, not
  // authorised, not under an MGA", and a law that matches any FCA-adjacent
  // status word necessarily matches the true sentence as well as the false
  // one. That is the trade the law is making: it cannot tell truth from
  // falsehood, only a human can, so each true one is written down here with
  // the reason it is true rather than being quietly excluded by the regex.
  'client/src/components/BetaEstimateCard.tsx::fca regulatory':
    'The agreed line, on the beta estimate disclaimer: "working towards the FCA regulatory sandbox, not authorised and not operating under an MGA". Reconciled 26 Aug after it had reverted to the stronger "pending FCA authorisation".',
  'client/src/pages/policy.tsx::fca regulatory':
    'Two honest empty states, both conditional: cover "cannot issue one until it is through the FCA regulatory sandbox", refunds the same.',
  'client/src/components/profile/CoverageTypeSection.tsx::fca regulatory':
    'Empty state: "Driiva cannot issue policies until it is through the FCA regulatory sandbox". A statement of what we cannot do. Moved here from client/src/pages/profile.tsx when that page was split.',
  'client/src/pages/terms.tsx::fca regulatory':
    'Legal page, the agreed line in full: "working towards the FCA regulatory sandbox, is not authorised, and is not operating under an MGA".',
  'client/src/pages/trust.tsx::fca sandbox':
    'Badge label "Working towards FCA sandbox". Towards, not in.',
  'client/src/pages/trust.tsx::fca regulatory':
    'The agreed line, twice, each followed by the explicit denial: "We are not authorised by the FCA, we are not operating under an MGA, and we cannot sell".',
  'apps/marketing/src/routes/Complaints.tsx::fca regulatory':
    'Legal page, conditional: the FOS route opens "when Driiva is through the FCA regulatory sandbox and able to sell motor insurance". Not yet.',
  'apps/marketing/src/routes/Privacy.tsx::fca sandbox':
    'Legal page, conditional and future tense: a product privacy notice arrives "when Driiva begins underwriting real policies (post FCA Sandbox)".',
  'apps/marketing/src/routes/Terms.tsx::fca regulatory':
    'The agreed line on the Terms page, followed by "We are not authorised to issue motor insurance".',
  'apps/marketing/src/sections/BetaCountdown.tsx::fca sandbox':
    'A source comment noting the beta target date moves with the sandbox milestone. Not rendered, and not a claim about status.',
  'apps/marketing/src/sections/FAQ.tsx::fca authorises':
    'Answer to "What happens if I have an accident?": "Nothing yet, because we cannot sell you a policy until the FCA authorises us." The FCA has not.',
  'apps/marketing/src/sections/FAQ.tsx::fca regulatory':
    'The agreed line as the answer to "Are you FCA-regulated?", which begins "Not yet."',
  'apps/marketing/src/sections/Footer.tsx::fca regulatory':
    'Site-wide fine print, the agreed line: "working towards the FCA regulatory sandbox and is not yet authorised to issue motor insurance policies".',
  'apps/marketing/src/sections/Pool.tsx::fca sandbox':
    'Illustration label: "Nothing is paid until we are through the FCA sandbox", under an explicit "Illustration, not a quote" heading.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca sandbox':
    'Source comment: real underwriting "will replace this once Driiva is through the FCA sandbox". Future tense, not rendered.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca regulatory':
    'The honest-framing exemplar: "Real pricing happens once we are through the FCA regulatory sandbox and we score your actual driving".',
  'apps/marketing/api/lib/waitlist-core.ts::fca regulatory':
    'The agreed line in the confirmation email that goes to real signups, in both the HTML and the plain-text part: "working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer." This file is why the law exists; it once emailed real people that Driiva was in the "FCA Regulatory Sandbox application phase".',
  // ── Mobile, in scope since 26 Aug 2026
  'mobile/app/(tabs)/community.tsx::fca regulatory':
    'Header comment explaining why no pound figure may appear against the pool: the company is "only working towards the FCA regulatory sandbox and is not authorised". Not rendered.',
  'mobile/app/(tabs)/profile.tsx::fca regulatory':
    'The settings legal line, the agreed wording in its shortest form: "Working towards the FCA regulatory sandbox, not authorised, not operating under an MGA".',
  'mobile/app/(tabs)/rewards.tsx::fca regulatory':
    'Rewards disclaimer, the agreed line plus "Nothing on this screen is a binding offer".',
  'mobile/app/onboarding/account.tsx::fca regulatory':
    'The agreed line on the Shariah badge. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/comparison.tsx::fca regulatory':
    'The agreed line on the comparison callout. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/index.tsx::fca regulatory':
    'The agreed line on the first onboarding screen. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/quote.tsx::fca regulatory':
    'The agreed line twice: on the quote stub and on the refund-estimate disclaimer. Both were "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/social-proof.tsx::fca regulatory':
    'The agreed line on the disclaimer under the principles list.',
  'mobile/app/trust.tsx::fca regulatory':
    'The financial-promotion disclaimer, the agreed line: "working towards the FCA regulatory sandbox and is not authorised".',
  'mobile/app/trust.tsx::we are authorised':
    'Conditional: "When we are authorised to distribute policies". Same construction as the already-acknowledged apps/marketing/src/routes/Terms.tsx.',
  'mobile/app/trust.tsx::underwritten by':
    'Future tense since 26 Aug: "When we are authorised to distribute policies, they will be underwritten by a regulated capacity partner". The screen previously said policies ARE underwritten by our capacity partner, in the present tense, on a product with no insurer and no partner. Matched to the wording already on client/src/pages/trust.tsx.',
  'mobile/app/trust.tsx::capacity partner':
    'Same sentence, and the paragraph now ends "No capacity partner is in place today".',
  "mobile/app/trips/[tripId].tsx::?? 'unknown'":
    'A trip whose route will not resolve a start or end place has no known start or end place. "Unknown" is the fact, not a stand-in for it. Same case as the already-acknowledged client/src/hooks/useDashboardData.ts.',

  'apps/marketing/public/llms.txt::fca regulatory':
    'The machine-readable summary states the position three times and each is the agreed line or its denial: line 3 "working towards the FCA regulatory sandbox, is not FCA authorised, is not operating under an MGA", line 10 the regulatory-position list, line 53 the do-say list.',

  // ── Placeholders that are correct
  'client/src/pages/forgot-password.tsx::example.com':
    'Input placeholder "you@example.com". example.com is the reserved documentation domain; it cannot reach a real person.',
  'client/src/pages/signin.tsx::example.com':
    'Input placeholder.',
  'client/src/pages/signup.tsx::example.com':
    'Input placeholder.',
  'apps/marketing/src/routes/Complaints.tsx::0800 023 4567':
    'The real Financial Ombudsman Service number, alongside their real address at Exchange Tower, London E14 9SR. Verified against financial-ombudsman.org.uk being cited in the same list.',
  // ── Fallbacks that stand in for something genuinely unknown, which is the
  // opposite of a confident stand-in
  "client/src/hooks/useDashboardData.ts::|| 'unknown'":
    'A trip whose routeSummary will not split has no known start or end place. "Unknown" is the fact.',
  "client/src/pages/admin/monitoring.tsx::|| 'unknown'":
    'Admin health panel: a check that reported nothing is of unknown status. Admin-only, and accurate.',
  'server/seed.ts::test@d':
    'Local seed script, never imported by the server. The seed data itself is a reported HIGH finding (fabricated pool and refund), tracked separately; this entry only acknowledges the address.',

  // ── Money on rendered surfaces
  'apps/marketing/src/sections/Pool.tsx::£840':
    'Worked example under an explicit "Illustration, not a quote" label.',
  'apps/marketing/src/sections/Pool.tsx::£150':
    'Same illustration.',
  'apps/marketing/src/sections/Pool.tsx::£30':
    'Same illustration.',
  'apps/marketing/src/sections/Pool.tsx::£180':
    'Same illustration.',
  'client/src/components/ui/Readout.tsx::£12.40':
    'Component documentation example in a doc comment, not rendered.',
  'client/src/components/ui/Readout.tsx::£1,204.50':
    'Component documentation example in a doc comment, not rendered.',
  'client/src/components/profile/CoverageTypeSection.tsx::£20m':
    'The Wave G comment recording why the benefit list is now gated, and the benefit line itself, which renders only behind a real coverageType. Moved here from client/src/pages/profile.tsx when that page was split.',
  'client/src/components/profile/CoverageTypeSection.tsx::£100,000':
    'The same Wave G comment and the same coverageType gate.',

  // ── Copy printed from a stylesheet
  'apps/marketing/src/styles/global.css::typical':
    'The comparison table drops its header row under 760px, so each cell labels its own column. "Typical" is the mobile-width form of the desktop header "Traditional UK insurer". It names a column, it does not claim anything about a competitor. Its sibling label is the drawn wordmark as a background image, not type.',
}));

const PLANTED = `
// A planted file. Every law that reads components must fire on it.
export const badge = 'Driiva Ltd. Authorised and regulated by the Financial Conduct Authority.';
// The paraphrases. The old regulatory-claim law matched none of these, which
// is how "pending FCA authorisation" survived on eight screens for sixteen
// days after the sweep that was meant to have removed it. They are planted
// individually because each is a different way of not saying "authorised".
export const pending = 'Our insurance product is pending FCA authorisation.';
export const awaiting = 'We are awaiting FCA sign-off on the product.';
export const applied = 'Our FCA application is in review.';
export const phase = 'Driiva is in the FCA Regulatory Sandbox application phase.';
export const scale = 'Join thousands of drivers already saving.';
export const money = 'Refunds tracked: £18.4k, paid out within 14 days.';
export const who = 'Test Driver, 0800 123 4567, test@driiva.co.uk';
export const bound = { status: rootPolicy.status || 'active', safety: pool.factor ?? 1.0 };
`;

/**
 * Lines of PLANTED that must each be caught in their own right.
 *
 * "Every law fired at least once" is too weak a plant check for a law with ten
 * alternatives in it: `badge` alone trips regulatory-claim, and the four
 * paraphrases below could all silently stop matching while the planted run
 * still reported that the gate works. That is the same shape as the design:laws
 * plant check that certified a two-thirds-blind gate. So the planted run
 * asserts these BY LINE, not by law.
 */
const PLANTED_LINES_THAT_MUST_TRIP = [
  ['regulatory-claim', 'pending FCA authorisation'],
  ['regulatory-claim', 'awaiting FCA sign-off'],
  ['regulatory-claim', 'FCA application is in review'],
  ['regulatory-claim', 'Sandbox application phase'],
  ['regulatory-claim', 'Authorised and regulated by the Financial Conduct Authority'],
];

/**
 * The stylesheet half of the planted run. The laws that only read CSS cannot
 * fire on planted.tsx, so proving they work needs their own specimen.
 *
 * The decorative declarations at the bottom are as load-bearing as the
 * violations above them: if the law starts matching those, it is matching
 * every pseudo-element in the codebase and is about to be turned off.
 */
const PLANTED_CSS = `
/* Violations. Each must be caught. */
.a::before { content: '117+ on the list'; }
.b::after  { content: "Authorised and regulated by the Financial Conduct Authority"; }
.c::before { content: attr(data-claim); }
.d { background-image: url("data:image/svg+xml,%3Csvg%3E%3Ctext%3ETrusted by thousands%3C/text%3E%3C/svg%3E"); }

/* Furniture. None of these may fire, or the law is unusable. */
.e::before { content: ''; }
.f::after  { content: " "; }
.g::before { content: '\\2014'; }
.h::after  { content: '•'; }
.i::before { content: '→'; }
.j { justify-content: space-between; align-content: center; }
`;

export function runFabricationLaws({ planted = false } = {}) {
  const files = DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((f) =>
    relative(ROOT, f).split('\\').join('/'),
  );

  const targets = files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]);
  if (planted) {
    targets.push(['planted.tsx', PLANTED]);
    targets.push(['planted.css', PLANTED_CSS]);
  }

  const results = LAWS.map((law) => ({ id: law.id, title: law.title, violations: [] }));

  for (const [file, source] of targets) {
    LAWS.forEach((law, i) => {
      if (law.filesOnly && !law.filesOnly.test(file)) return;
      // A law either greps for a shape or, where a regex would drown in false
      // positives, walks the syntax itself. Both yield {index, text}.
      const hits = law.extract
        ? law.extract(source)
        : [...source.matchAll(law.pattern)].map((m) => ({ index: m.index, text: m[0] }));
      for (const hit of hits) {
        const text = hit.text.trim();
        const key = `${file}::${text.toLowerCase()}`;
        if (ALLOWED.has(key)) continue;
        results[i].violations.push({ file, line: lineOf(source, hit.index), detail: text });
      }
    });
  }

  return { fileCount: files.length, laws: results, total: results.reduce((n, l) => n + l.violations.length, 0) };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (!process.env.VITEST && process.argv[1] && process.argv[1].endsWith('fabrication-laws.mjs')) {
  const planted = process.env.PLANT_VIOLATION === '1';
  if (planted) console.log('PLANT_VIOLATION=1: a file breaking every law is linted alongside the real source.\n');

  const result = runFabricationLaws({ planted });
  console.log(`fabrication laws: ${result.fileCount} files\n`);

  let failed = 0;
  for (const law of result.laws) {
    if (law.violations.length === 0) {
      console.log(`  pass  ${law.title}`);
      continue;
    }
    failed += 1;
    console.log(`  FAIL  ${law.title} (${law.violations.length})`);
    for (const v of law.violations.slice(0, 15)) {
      console.log(`          ${v.file}:${v.line}  ${v.detail}`);
    }
    if (law.violations.length > 15) console.log(`          ... and ${law.violations.length - 15} more`);
  }

  console.log('');
  if (planted) {
    const quiet = result.laws.filter((l) => l.violations.length === 0);
    if (quiet.length > 0) {
      console.log(`planted run did NOT trip: ${quiet.map((l) => l.id).join(', ')}`);
      process.exit(1);
    }

    // A law firing somewhere is not the same as a law firing on the specimen
    // it was written for. Check the specimens themselves.
    const missed = PLANTED_LINES_THAT_MUST_TRIP.filter(([lawId, needle]) => {
      const law = result.laws.find((l) => l.id === lawId);
      if (!law) return true;
      const source = PLANTED.split('\n');
      return !law.violations.some(
        (v) => v.file === 'planted.tsx' && (source[v.line - 1] || '').includes(needle),
      );
    });
    if (missed.length > 0) {
      console.log('planted run missed the specimens it was written for:');
      for (const [lawId, needle] of missed) console.log(`          ${lawId}  "${needle}"`);
      process.exit(1);
    }

    console.log('planted run tripped every law, as it must.');
    console.log(`and caught all ${PLANTED_LINES_THAT_MUST_TRIP.length} named specimens by line.`);
    process.exit(0);
  }
  if (failed) {
    console.log('Each hit is either a fabrication to delete, or a true statement to add to ALLOWED with a reason.');
  }
  process.exit(failed ? 1 : 0);
}

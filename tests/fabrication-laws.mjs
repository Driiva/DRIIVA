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
const DIRS = ['client/src', 'apps/marketing/src', 'apps/marketing/api', 'server', 'functions/src'];
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
    } else if (/\.tsx?$/.test(entry) && !SKIP.test(full)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * The shapes. Each is deliberately broad: a false positive costs one allowlist
 * line, a false negative costs a regulatory incident.
 */
const LAWS = [
  {
    id: 'regulatory-claim',
    title: 'Claims about regulated status, underwriting or capacity',
    pattern:
      /authorised and regulated|FCA[- ]regulated|FCA[- ]authorised|FCA[- ]supervised|we are authorised|regulated by the Financial Conduct|underwritten by|PRA[- ]regulated|capacity partner|reinsur\w*|registration number/gi,
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
    // .tsx only: a literal in a .ts helper is usually maths, a literal in a
    // component is usually a number somebody reads.
    pattern: /£\s?\d[\d,]*(\.\d+)?\s?[kKmM]?/g,
    filesOnly: /\.tsx$/,
  },
];

/**
 * Every acknowledged hit, keyed "<file>::<matched text lowercased>".
 * A reason is mandatory. "It is fine" is not a reason.
 */
const ALLOWED = new Map(Object.entries({
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
  'client/src/pages/profile.tsx::£20m':
    'Inside the Wave G comment recording why the benefit list is now gated.',
  'client/src/pages/profile.tsx::£100,000':
    'Inside the same Wave G comment.',
}));

const PLANTED = `
// A planted file. Every law must fire on it.
export const badge = 'Driiva Ltd. Authorised and regulated by the Financial Conduct Authority.';
export const scale = 'Join thousands of drivers already saving.';
export const money = 'Refunds tracked: £18.4k, paid out within 14 days.';
export const who = 'Test Driver, 0800 123 4567, test@driiva.co.uk';
export const bound = { status: rootPolicy.status || 'active', safety: pool.factor ?? 1.0 };
`;

export function runFabricationLaws({ planted = false } = {}) {
  const files = DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((f) =>
    relative(ROOT, f).split('\\').join('/'),
  );

  const targets = files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]);
  if (planted) targets.push(['planted.tsx', PLANTED]);

  const results = LAWS.map((law) => ({ id: law.id, title: law.title, violations: [] }));

  for (const [file, source] of targets) {
    LAWS.forEach((law, i) => {
      if (law.filesOnly && !law.filesOnly.test(file)) return;
      for (const match of source.matchAll(law.pattern)) {
        const text = match[0].trim();
        const key = `${file}::${text.toLowerCase()}`;
        if (ALLOWED.has(key)) continue;
        results[i].violations.push({ file, line: lineOf(source, match.index), detail: text });
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
    console.log('planted run tripped every law, as it must.');
    process.exit(0);
  }
  if (failed) {
    console.log('Each hit is either a fabrication to delete, or a true statement to add to ALLOWED with a reason.');
  }
  process.exit(failed ? 1 : 0);
}

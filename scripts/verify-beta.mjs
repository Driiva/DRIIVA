#!/usr/bin/env node
/**
 * VERIFY BETA
 * ===========
 * The single command the beta brief gates "done" on. It runs everything that
 * can be run here, prints the budget table with measured values, and refuses
 * to report success while anything required is unproven.
 *
 * THE ONE RULE THIS SCRIPT EXISTS TO ENFORCE
 * Three states, not two: PASS, FAIL, and NOT REACHED. A harness that cannot
 * tell "it passed" from "it never got there" reports the second as the first,
 * and this repo has been bitten by that five separate times: design laws that
 * measured the sign-in page four times and called it four routes, an axe
 * runner that printed PASS seven times against a dead dev server, an emulator
 * suite seeding a field no writer populates. NOT REACHED fails the run here.
 *
 * WHAT THIS CANNOT DO, STATED PLAINLY
 * Cold start, screen-transition p95, crash-free sessions and the stranger test
 * need a real build on a real device. There is no Driiva app record in App
 * Store Connect and no attached emulator in this environment, so those rows
 * report NOT MEASURED and the run exits non-zero. That is the honest state of
 * the beta, and the brief refuses "done" until it changes.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PASS = 'PASS';
const FAIL = 'FAIL';
const NOT_REACHED = 'NOT REACHED';

const results = [];

function run(label, command, { optional = false } = {}) {
  process.stdout.write(`\n── ${label}\n`);

  const started = Date.now();
  const proc = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  // A null status means the process was killed or never started, which is
  // exactly the "never got there" case. It is not a pass and it is not an
  // ordinary failure.
  const state = proc.status === 0 ? PASS : proc.status === null ? NOT_REACHED : FAIL;

  results.push({ label, state, seconds, optional });
  process.stdout.write(`   ${state} in ${seconds}s\n`);
  return state === PASS;
}

function record(label, state, detail, { optional = false } = {}) {
  results.push({ label, state, detail, optional });
}

console.log('\nDriiva beta verification');
console.log('========================');

// ---------------------------------------------------------------------------
// Static correctness
// ---------------------------------------------------------------------------
run('Typecheck, root', 'npx tsc --noEmit');
run('Typecheck, mobile', 'cd mobile && npx tsc --noEmit');

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------
run('Unit suite', 'npx vitest run');
run('Rules suite, against the emulator', 'npm run test:rules');
run('Integration suite, including the scripted core loop', 'npm run test:integration');

// ---------------------------------------------------------------------------
// House laws
// ---------------------------------------------------------------------------
run('Mobile source laws', 'npm run design:laws:mobile');
run('Fabrication laws', 'npm run fabrication:laws');

// ---------------------------------------------------------------------------
// Budget metrics that can be measured from source
// ---------------------------------------------------------------------------
let onboardingScreens = 0;
try {
  const flow = readFileSync(new URL('../mobile/lib/onboardingFlow.ts', import.meta.url), 'utf8');
  const block = flow.match(/ONBOARDING_STEPS = \[([\s\S]*?)\] as const;/);
  onboardingScreens = block ? (block[1].match(/'/g) ?? []).length / 2 : 0;
} catch {
  onboardingScreens = 0;
}

record(
  'Onboarding screens in the committed flow',
  onboardingScreens > 0 ? PASS : NOT_REACHED,
  `${onboardingScreens}/${onboardingScreens}`,
);

// ---------------------------------------------------------------------------
// What needs a device. Declared, never silently skipped.
// ---------------------------------------------------------------------------
const DEVICE_GATED = [
  ['Cold start to interactive, mid-tier Android', '<= 2500 ms'],
  ['Screen transition p95', '<= 300 ms'],
  ['Crash-free sessions across the eval run', '100%'],
  ['Screen inventory screenshots, every screen x 4 states', 'exported'],
  ['Stranger test, zero founder interventions', 'analytics trail for that user id'],
];

for (const [label, target] of DEVICE_GATED) {
  record(label, NOT_REACHED, `needs a real build on a device, target ${target}`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('\n\nBudget table');
console.log('============\n');

const width = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
  const detail = r.detail ? `  ${r.detail}` : r.seconds ? `  ${r.seconds}s` : '';
  console.log(`  ${r.state.padEnd(11)}  ${r.label.padEnd(width)}${detail}`);
}

const failed = results.filter((r) => r.state === FAIL && !r.optional);
const notReached = results.filter((r) => r.state === NOT_REACHED && !r.optional);

console.log('');
console.log(`  ${results.filter((r) => r.state === PASS).length} passed`);
console.log(`  ${failed.length} failed`);
console.log(`  ${notReached.length} not reached`);

if (failed.length === 0 && notReached.length === 0) {
  console.log('\nBeta verification is green.\n');
  process.exit(0);
}

console.log('\nBeta verification is NOT green.');
if (failed.length > 0) {
  console.log('\n  Failing:');
  for (const r of failed) console.log(`    - ${r.label}`);
}
if (notReached.length > 0) {
  console.log('\n  Not reached, which is not the same as passing:');
  for (const r of notReached) console.log(`    - ${r.label}${r.detail ? `: ${r.detail}` : ''}`);
}
console.log('');

process.exit(1);

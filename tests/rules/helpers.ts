/**
 * Shared setup for the Firestore rules-emulator suite.
 *
 * Loads the REAL `firestore.rules` file (not a re-implementation) into the
 * Firestore emulator via `@firebase/rules-unit-testing`, so these tests
 * exercise the actual production rules byte-for-byte.
 *
 * Requires the Firestore emulator to be running on 127.0.0.1:8080 — see
 * the `test:rules` script in package.json, which boots it via
 * `firebase emulators:exec`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;

/**
 * Spins up a fresh rules-test environment against the emulator, scoped to
 * its own projectId so parallel test files never share Firestore state.
 */
export async function createTestEnv(projectId: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: EMULATOR_HOST,
      port: EMULATOR_PORT,
    },
  });
}

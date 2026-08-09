/**
 * SHAPE GUARD - reader/writer agreement on the user document (Wave 0, 0e).
 *
 * Two field-name divergences shipped to real users because nothing checked
 * that the code writing a document and the code reading it agreed:
 *
 *   1. Every writer set `drivingProfile.currentScore`; the mobile dashboard
 *      read `drivingProfile.overallSafetyScore`, a field that has never
 *      existed. The headline safety score showed 0 in the red tier forever.
 *
 *   2. The trip trigger wrote `{tripId, distanceMiles, durationMinutes}`; the
 *      mobile dashboard read `{id, distanceMeters, durationSeconds}`. Every
 *      recent-trip row rendered "NaN mi · NaN min" under an undefined key the
 *      moment a real trip landed.
 *
 * TypeScript could not catch either one: the readers type their own local
 * interface over `doc.data()`, which is `any` at the Firestore boundary. So
 * this test reads the actual source files and fails if the names drift apart
 * again. It is deliberately source-level - that is the only place the
 * disagreement is visible.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { RecentTripSummarySchema, DrivingProfileDataSchema } from '../user';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function read(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

/** Pulls the property names out of a named TypeScript interface body. */
function interfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(
    new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) throw new Error(`interface ${interfaceName} not found`);
  return [...match[1].matchAll(/^\s*(\w+)\??\s*:/gm)].map((m) => m[1]);
}

describe('RecentTripSummary shape', () => {
  const canonicalFields = Object.keys(RecentTripSummarySchema.shape).sort();

  it('is metres and seconds, never miles or minutes', () => {
    expect(canonicalFields).toContain('distanceMeters');
    expect(canonicalFields).toContain('durationSeconds');
    expect(canonicalFields).not.toContain('distanceMiles');
    expect(canonicalFields).not.toContain('durationMinutes');
  });

  it('matches the Cloud Functions interface field for field', () => {
    const functionsFields = interfaceFields(
      read('functions/src/types.ts'),
      'RecentTripSummary',
    ).sort();

    expect(functionsFields).toEqual(canonicalFields);
  });

  it('is written by the trip trigger using only canonical field names', () => {
    const trigger = read('functions/src/triggers/trips.ts');
    const summaryLiteral = trigger.match(
      /const tripSummary: RecentTripSummary = \{([\s\S]*?)\n {4}\};/,
    );
    expect(summaryLiteral).not.toBeNull();

    const writtenFields = [
      ...summaryLiteral![1].matchAll(/^\s*(\w+)[,:]/gm),
    ].map((m) => m[1]);

    expect(writtenFields.sort()).toEqual(canonicalFields);
  });

  it('is read by the mobile dashboard using canonical field names only', () => {
    const mobileFields = interfaceFields(
      read('mobile/app/(tabs)/dashboard.tsx'),
      'RecentTrip',
    );

    // The reader may use a subset (it does not need the timestamps), but every
    // field it does read must be one the writer actually writes.
    expect(mobileFields.length).toBeGreaterThan(0);
    for (const field of mobileFields) {
      expect(canonicalFields).toContain(field);
    }
  });
});

describe('drivingProfile score field', () => {
  it('is named currentScore in the contract', () => {
    const fields = Object.keys(DrivingProfileDataSchema.shape);
    expect(fields).toContain('currentScore');
    expect(fields).not.toContain('overallSafetyScore');
  });

  it('is not read as overallSafetyScore anywhere in the app surfaces', () => {
    const surfaces = [
      'mobile/app/(tabs)/dashboard.tsx',
      'client/src/hooks/useDashboardData.ts',
    ];

    for (const surface of surfaces) {
      // Comments explaining the historic bug are fine; a property read is not.
      const code = read(surface)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code).not.toMatch(/overallSafetyScore/);
    }
  });

  it('is read as currentScore by the mobile dashboard', () => {
    expect(read('mobile/app/(tabs)/dashboard.tsx')).toMatch(
      /profile\.currentScore/,
    );
  });
});

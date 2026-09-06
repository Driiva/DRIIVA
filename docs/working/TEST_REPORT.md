# Regression test report

**Date:** 2026-02-17  
**Scope:** Full test suite (vitest)  
**Command:** `npm run test`

---

## Summary

| Result | Count |
|--------|--------|
| Test files | 4 passed |
| Tests | 74 passed |
| Failures | 0 |

All tests passed. No failing tests required fixes.

---

## Test files

| File | Tests | Status |
|------|--------|--------|
| `client/src/__tests__/trip-metrics.test.ts` | 26 | ✓ |
| `client/src/__tests__/insurance.test.ts` | 16 | ✓ |
| `client/src/__tests__/feature-flags.test.ts` | 4 | ✓ |
| `client/src/__tests__/scoring.test.ts` | 28 | ✓ |

---

## Coverage areas

- **Trip metrics:** Haversine distance, weighted average, risk tier, projected refund, address truncation, share ID, heading normalization.
- **Insurance:** Quote/premium and policy-related logic (mocks).
- **Feature flags:** Client and server flag resolution.
- **Scoring:** Driving score breakdown and composite (aligned with backend formulas).

---

## Notes

- No automated tests currently exist for the Express server or Firebase Cloud Functions; only client-side and pure helper tests run in this suite.
- Trip duration/distance logic is now standardized on `shared/tripProcessor.ts`; server uses it; functions mirror the same formulas (see REFACTOR_DIFF_SUMMARY.md).

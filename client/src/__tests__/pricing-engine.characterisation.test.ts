/**
 * CHARACTERISATION SUITE — client pricing engine (rebuild mission, 2026-07).
 *
 * Locks in the CURRENT premium mathematics of client/src/lib/pricingEngine.ts.
 * This is client-side money logic (the June audit found the server/Root quote
 * is authoritative at checkout when available, with this engine as the
 * fallback and the pre-quote display source) — the rebuild must reproduce
 * these figures or consciously change them.
 *
 * M2 repoint (T4): scoreFactor / scoreDiscountPercent are no longer DEFINED in
 * pricingEngine.ts - they are imported from the canonical @driiva/scoring
 * package and re-exported (so this suite's import path is unchanged). The
 * assertions below are deliberately UNCHANGED and still green, which proves the
 * repointed functions are byte-identical to the deleted local copies (the port
 * was verified byte-faithful in M0). calculateAnnualPremium still exercises the
 * canonical scoreFactor through that re-export. WEB-13/WEB-21 are refund-display
 * bugs in dashboard/policy/profile (not this pricing path), so nothing here moves.
 *
 * QUIRK pinned: vehicleFactor depends on new Date().getFullYear(), so the
 * same inputs price differently across calendar years. Clock frozen at
 * 2026-07-02 here; the assertions below are only valid at that date.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  calculateAnnualPremium,
  calculateMonthlyPremium,
  scoreFactor,
  scoreDiscountPercent,
  formatGbp,
  DEMO_PRICING_INPUTS,
} from "@/lib/pricingEngine";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("scoreFactor — the single ±15% source of truth (post-June-fix)", () => {
  it("maps the documented anchor points: 75 neutral, 100 → 0.85, 50 → 1.15", () => {
    expect(scoreFactor(75)).toBe(1.0);
    expect(scoreFactor(100)).toBe(0.85);
    expect(scoreFactor(50)).toBeCloseTo(1.15, 10);
  });

  it("clamps outside 50..100 (score 0 prices like 50; 120 like 100)", () => {
    expect(scoreFactor(0)).toBeCloseTo(1.15, 10);
    expect(scoreFactor(120)).toBe(0.85);
  });

  it("no score → neutral 1.0", () => {
    expect(scoreFactor(null)).toBe(1.0);
    expect(scoreFactor(undefined)).toBe(1.0);
  });
});

describe("scoreDiscountPercent — display figure derived from the charged factor", () => {
  it("15% at score 100, 0% at neutral 75", () => {
    expect(scoreDiscountPercent(100)).toBe(15);
    expect(scoreDiscountPercent(75)).toBe(0);
  });

  it("QUIRK: loadings (score < 75) are displayed as 0% discount, never negative", () => {
    expect(scoreDiscountPercent(50)).toBe(0);
    expect(scoreDiscountPercent(60)).toBe(0);
  });

  it("rounds to whole percent (score 90 → 9%)", () => {
    expect(scoreDiscountPercent(90)).toBe(9);
  });
});

describe("calculateAnnualPremium (clock frozen at 2026)", () => {
  it("all-null inputs → the £1,200 base", () => {
    expect(calculateAnnualPremium({})).toBe(1200);
  });

  it("DEMO_PRICING_INPUTS (2022 Golf, 28yo, 2yr NCB, E1, score 82) → £1,210", () => {
    // 1200 × 1.10 (4yo car) × 1.00 (28) × 0.80 (2yr NCB) × 1.20 (E London) × 0.958 (score 82)
    expect(calculateAnnualPremium(DEMO_PRICING_INPUTS)).toBe(1210);
  });

  it("young driver + nearly-new car + inner London hits the £2,400 ceiling", () => {
    expect(
      calculateAnnualPremium({ vehicleYear: 2025, age: 19, noClaimsYears: 0, postcode: "SW1A 1AA" })
    ).toBe(2400);
  });

  it("max NCB + rural + old car + perfect score hits the £480 floor", () => {
    expect(
      calculateAnnualPremium({
        vehicleYear: 2010,
        age: 55,
        noClaimsYears: 5,
        postcode: "IV2 3AB",
        drivingScore: 100,
      })
    ).toBe(480);
  });

  it("NCB is clamped to 0..5 (negative treated as 0, 10 years capped at 50% off)", () => {
    expect(calculateAnnualPremium({ noClaimsYears: -3 })).toBe(
      calculateAnnualPremium({ noClaimsYears: 0 })
    );
    expect(calculateAnnualPremium({ noClaimsYears: 10 })).toBe(
      calculateAnnualPremium({ noClaimsYears: 5 })
    );
  });

  it("postcode matching uses the real outward-code AREA (letters before the first digit): SW1A → SW (high risk), IV2 → IV (low risk)", () => {
    expect(calculateAnnualPremium({ postcode: "sw1a 1aa" })).toBe(1440); // case-insensitive, ×1.20
    expect(calculateAnnualPremium({ postcode: "IV2 3AB" })).toBe(1080); // ×0.90
  });

  it("D7 FIX: Bath (BA) no longer falls through to Birmingham's (B) +20% loading - BA is its own low-risk area", () => {
    expect(calculateAnnualPremium({ postcode: "BA1 1LZ" })).toBe(1080); // ×0.90, distinct from B's ×1.20
    expect(calculateAnnualPremium({ postcode: "B1 1AA" })).toBe(1440); // Birmingham itself is still ×1.20
  });

  it("D7 FIX: unlisted areas resolve to the neutral 1.00 multiplier instead of silently borrowing an unrelated single-letter neighbour's risk tier (NG Nottingham, GL Gloucester previously mispriced as N/G)", () => {
    expect(calculateAnnualPremium({ postcode: "NG1 5DT" })).toBe(1200);
    expect(calculateAnnualPremium({ postcode: "GL1 1DP" })).toBe(1200);
    // A genuinely neutral, always-unlisted prefix: OX Oxford
    expect(calculateAnnualPremium({ postcode: "OX1 2JD" })).toBe(1200);
  });

  it("D7 FIX: BD (Bradford), BL (Bolton), BN (Brighton), SN (Swindon) are distinct entries, not aliases of B (Birmingham) / S (Sheffield)", () => {
    expect(calculateAnnualPremium({ postcode: "BD1 1AA" })).toBe(1320); // ×1.10, not B's ×1.20
    expect(calculateAnnualPremium({ postcode: "BL1 1AA" })).toBe(1320); // ×1.10
    expect(calculateAnnualPremium({ postcode: "BN1 1AA" })).toBe(1320); // ×1.10
    expect(calculateAnnualPremium({ postcode: "SN1 1AA" })).toBe(1320); // ×1.10, not S's ×1.20
    expect(calculateAnnualPremium({ postcode: "S1 1AA" })).toBe(1440);  // Sheffield itself is still ×1.20
  });

  it("D7 FIX: an outward code with no leading letters (numeric-only garbage) is treated as unlisted, not a crash", () => {
    expect(calculateAnnualPremium({ postcode: "1234" })).toBe(1200);
  });

  it("QUIRK: vehicle factor is calendar-dependent — a 2023 car is 'nearly new' (×1.28) in 2026 but will silently reprice to ×1.10 from Jan 2027", () => {
    expect(calculateAnnualPremium({ vehicleYear: 2023 })).toBe(1540); // 1200 × 1.28 rounded to £10
    vi.setSystemTime(new Date("2027-01-01T00:00:01Z"));
    expect(calculateAnnualPremium({ vehicleYear: 2023 })).toBe(1320); // 1200 × 1.10
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
  });
});

describe("calculateMonthlyPremium — 7% instalment loading", () => {
  it("£1,200 annual → £107.00/month", () => {
    expect(calculateMonthlyPremium(1200)).toBe(107);
  });

  it("rounds to pence (£1,210 → £107.89)", () => {
    expect(calculateMonthlyPremium(1210)).toBe(107.89);
  });
});

describe("formatGbp", () => {
  it("annual style: £1,200 with en-GB thousands separator, rounded", () => {
    expect(formatGbp(1200)).toBe("£1,200");
    expect(formatGbp(1204.6)).toBe("£1,205");
  });

  it("pence style: £107.00", () => {
    expect(formatGbp(107, true)).toBe("£107.00");
  });
});

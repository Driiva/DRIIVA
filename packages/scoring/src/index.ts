/**
 * @driiva/scoring
 * ===============
 * The single deterministic scoring implementation: driving-score computation
 * from raw GPS points, the score-to-premium factor, and refund-pool
 * arithmetic. Ported verbatim from `functions/`, `client/`, `shared/` (M0
 * Task 2) — those originals stay in place until M2 repoints consumers here.
 */
export * from './tripMetrics';
export * from './scoreFactor';
export * from './refund';

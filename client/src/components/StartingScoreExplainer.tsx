/**
 * STARTING SCORE EXPLAINER
 * ========================
 * Answers the question a new driver actually asks: what score do I start on,
 * and does it mean anything yet.
 *
 * Both the number and the wording come from @driiva/contracts, which is also
 * what the provisioning function writes, so this cannot drift into telling
 * people a number the backend does not use.
 *
 * The honest shape of the answer is slightly awkward and said anyway: the
 * starting score is a placeholder that the first scored trip replaces
 * outright. Implying a new driver must protect it would be a lie, and a
 * quietly demotivating one, since their first real trip would look like a
 * loss.
 */
import { Info } from 'lucide-react';
import { STARTING_SCORE, STARTING_SCORE_COPY } from '@driiva/contracts';

export function StartingScoreExplainer({ variant = 'card' }: { variant?: 'card' | 'inline' }) {
  if (variant === 'inline') {
    return (
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--app-text-sec)' }}>
        {STARTING_SCORE_COPY.long}
      </p>
    );
  }

  return (
    <div
      className="flex gap-3 p-3 mt-4"
      style={{
        borderRadius: 'var(--radius-card)',
        background: 'var(--app-surface-2)',
        border: '1px solid var(--app-border)',
      }}
    >
      <Info
        size={18}
        strokeWidth={2}
        style={{ color: 'var(--app-primary)', flexShrink: 0, marginTop: 2 }}
        aria-hidden="true"
      />
      <div>
        <p className="text-[14px] mb-1" style={{ color: 'var(--app-text-pri)' }}>
          You start on <span className="tabular">{STARTING_SCORE}</span>.
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--app-text-sec)' }}>
          {STARTING_SCORE_COPY.long}
        </p>
      </div>
    </div>
  );
}

export default StartingScoreExplainer;

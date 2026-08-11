import { useInView } from '@/hooks/useInView';
import { useReveal } from '@/hooks/useReveal';
import { PRIORITIES, SURVEY, WISHES, ANSWERED_WISHES } from '@/data/survey';

/*
 * What drivers actually asked for.
 *
 * The honest framing is the point of this section, not a disclaimer bolted to
 * the bottom of it. n=17 is stated in the headline rather than buried, because
 * a vague "drivers tell us" reads as a claim about the market while "we asked
 * 17 people" reads as what it is. The provenance line under the bars carries
 * the rest: our own survey, the dates, and the fact that it is not a
 * representative sample.
 *
 * The zero is deliberately kept and deliberately not hidden. Nobody picked
 * real-time tracking - it is the single most interesting number here, and it
 * is the one a normal marketing section would quietly drop for looking empty.
 * It gets a rendered rail at zero width and a plain "0".
 */
export function Voices() {
  const revealRef = useReveal<HTMLElement>();
  const [barsRef, barsInView] = useInView<HTMLDivElement>({ threshold: 0.25, once: true });

  const pct = (count: number) => Math.round((count / SURVEY.n) * 1000) / 10;

  return (
    <section ref={revealRef} id="voices" data-section="voices">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Driver research</span>
          <h2>We asked {SURVEY.n} drivers. Nobody chose tracking.</h2>
          <p>
            Before we wrote a line of the scoring engine we ran a short survey on what people
            actually value. Real-time tracking, the thing telematics insurers lead with, was the one
            option not a single person picked.
          </p>
        </div>

        <div ref={barsRef} className="voices-bars reveal-init" data-testid="voices-bars">
          {PRIORITIES.map((p, i) => (
            <div className="voices-bar" key={p.label}>
              <div className="voices-bar-head">
                <span className="voices-bar-label">{p.label}</span>
                <span className="voices-bar-count">
                  {p.count}
                  <span className="voices-bar-pct">{pct(p.count)}%</span>
                </span>
              </div>
              <div className="voices-bar-track">
                <span
                  className="voices-bar-fill"
                  style={{
                    width: barsInView ? `${pct(p.count)}%` : '0%',
                    transitionDelay: `${i * 90}ms`,
                  }}
                />
              </div>
            </div>
          ))}

          <p className="voices-note">
            Our own survey of {SURVEY.n} drivers, {SURVEY.from} to {SURVEY.to}. Multiple choices
            allowed, so these do not total {SURVEY.n}. A small sample and not a representative one,
            shown because it shaped what we built, not as evidence of a market.
          </p>
        </div>

        <div className="voices-wishes">
          <h3 className="voices-wishes-head">
            Asked what they wanted instead, {ANSWERED_WISHES} answered in their own words.
          </h3>
          <div className="voices-wish-grid">
            {WISHES.map((w) => (
              <blockquote className="glass glass-hover voices-wish reveal-init" key={w}>
                {w}
              </blockquote>
            ))}
          </div>
          <p className="voices-note">
            Verbatim, unedited. Driiva was built to answer the first two: pay out properly, and give
            money back when the driving earns it.
          </p>
        </div>
      </div>
    </section>
  );
}

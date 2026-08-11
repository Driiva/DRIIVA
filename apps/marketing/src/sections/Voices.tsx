import { useInView } from '@/hooks/useInView';
import { useReveal } from '@/hooks/useReveal';
import { PRIORITIES, SURVEY, WISHES } from '@/data/survey';

/*
 * What drivers asked for.
 *
 * The sample size is deliberately NOT in the visible copy. Leading with "we
 * asked 17 drivers" put the weakest fact in the largest type and made a small
 * piece of research look like it was being defended rather than reported. The
 * numbers still have to be disclosed, so they moved to a marked footnote at
 * the foot of the page, which is where a reader looks for methodology and
 * where this kind of note has always lived.
 *
 * Nothing was softened on the way. The footnote still says the sample is
 * small, unrepresentative, not a young-driver sample and not verifiably UK.
 * Rounded whole percentages, because one decimal place on a sample this size
 * is false precision.
 *
 * The zero stays and stays visible. Nobody picked real-time tracking, it is
 * the most interesting thing here, and it is exactly what a normal marketing
 * section would drop for looking empty. It renders as an empty track.
 */
export function Voices() {
  const revealRef = useReveal<HTMLElement>();
  const [barsRef, barsInView] = useInView<HTMLDivElement>({ threshold: 0.25, once: true });

  const pct = (count: number) => Math.round((count / SURVEY.n) * 100);

  return (
    <section ref={revealRef} id="voices" data-section="voices">
      <div className="container">
        <div className="section-head reveal-init">
          <span className="eyebrow-mini">Driver research</span>
          <h2>
            We asked drivers what they value. Nobody chose tracking.
            <a href="#fn-survey" className="voices-fn-ref" aria-label="See survey footnote">
              *
            </a>
          </h2>
          <p>
            Before we wrote a line of the scoring engine we ran a survey on what people actually
            want from motor insurance. Real-time tracking, the thing telematics insurers lead with,
            was the one option nobody picked.
          </p>
        </div>

        <div ref={barsRef} className="voices-bars reveal-init" data-testid="voices-bars">
          {PRIORITIES.map((p, i) => (
            <div className="voices-bar" key={p.label}>
              <div className="voices-bar-head">
                <span className="voices-bar-label">{p.label}</span>
                <span className="voices-bar-count">{pct(p.count)}%</span>
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
        </div>

        <div className="voices-wishes">
          <h3 className="voices-wishes-head">Asked what they wanted instead, in their own words.</h3>
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

/*
 * Sits at the foot of the home page, below the last section. Not in the site
 * Footer, which renders on the legal routes too, where this note would be
 * describing research the page never mentions.
 */
export function VoicesFootnote() {
  return (
    <aside className="page-footnotes" aria-label="Footnotes">
      <div className="container">
        <p id="fn-survey" className="page-footnote">
          <span className="page-footnote-mark" aria-hidden="true">
            *
          </span>
          Our own survey of drivers, run between {SURVEY.from} and {SURVEY.to}, with{' '}
          {SURVEY.n} respondents. Respondents could select more than one feature, so the figures do
          not total 100%. It is a small sample and not a representative one: it was collected
          through an open link with no identity check, so it cannot be presented as a UK sample, and
          only two respondents were aged 18 to 24, so it is not a sample of the drivers Driiva is
          built for. We publish it because it shaped what we built first, not as evidence about the
          market. Full results at <a href="/uk-survey">what drivers told us</a>.
        </p>
      </div>
    </aside>
  );
}

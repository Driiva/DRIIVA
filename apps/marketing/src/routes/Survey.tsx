import { LegalPage } from './LegalPage';
import { PRIORITIES, SURVEY, WISHES, ANSWERED_WISHES } from '@/data/survey';

/*
 * This page used to invite people to take the survey, with a card saying the
 * form host was not wired up yet and to email us for the questions. The survey
 * had in fact been running and had stopped: 17 responses, the last of them in
 * August 2025, against a 25-response cap on the free plan. So the page was
 * asking people to join something that was finished.
 *
 * It now publishes what came back. Same URL, because it is linked from the
 * footer and from anything printed before today, and because "here is what you
 * told us" is the honest end of a page that once said "tell us".
 */
export function Survey() {
  const pct = (count: number) => Math.round((count / SURVEY.n) * 1000) / 10;

  return (
    <LegalPage title="What drivers told us" updated="2026-08-11">
      <p className="legal-lede">
        Before we built the scoring engine we ran a short survey on what people actually want from
        motor insurance. {SURVEY.n} drivers answered between {SURVEY.from} and {SURVEY.to}. This is
        all of it, including the parts that were not what we expected.
      </p>

      <h2>Which features do you find most valuable?</h2>
      <p>
        Multiple choices were allowed, so the counts total more than {SURVEY.n}. Not one person
        chose real-time tracking, the feature most telematics insurers lead with.
      </p>
      <ul>
        {PRIORITIES.map((p) => (
          <li key={p.label}>
            <strong>{p.label}</strong> - {p.count} of {SURVEY.n} ({pct(p.count)}%)
          </li>
        ))}
      </ul>

      <h2>What would you want instead?</h2>
      <p>{ANSWERED_WISHES} of {SURVEY.n} answered in their own words. Quoted unedited:</p>
      <ul>
        {WISHES.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <h2>How much this proves</h2>
      <p>
        Not much on its own, and we would rather say so than dress it up. {SURVEY.n} responses is a
        signal we used to decide what to build first, not evidence about the market. The survey ran
        on an open link with no identity check, so we cannot claim it as a UK sample. Only two
        respondents were 18 to 24, so it is not a sample of the drivers Driiva is built for either.
      </p>
      <p>
        It also collected no names or email addresses, by design. Nobody who answered was added to
        the waitlist or contacted afterwards.
      </p>
    </LegalPage>
  );
}

import { LegalPage } from './LegalPage';
import { PRIORITIES, SURVEY, WISHES } from '@/data/survey';

/*
 * This page used to invite people to take the survey, with a card saying the
 * form host was not wired up yet and to email us for the questions. The survey
 * had in fact been running and had stopped, and the last response was a year
 * old. So the page was asking people to join something that was finished.
 *
 * It now publishes what came back. Same URL, because it is linked from the
 * footer and from the footnote on the home page, and because "here is what you
 * told us" is the honest end of a page that once said "tell us".
 *
 * Findings first, methodology at the foot. Same order as the home page: the
 * sample size is disclosed in full, it just does not lead.
 */
export function Survey() {
  const pct = (count: number) => Math.round((count / SURVEY.n) * 100);

  return (
    <LegalPage title="What drivers told us" updated="2026-08-11">
      <p className="legal-lede">
        Before we built the scoring engine we ran a survey on what people actually want from motor
        insurance. This is all of it, including the parts that were not what we expected.
      </p>

      <h2>Which features do you find most valuable?</h2>
      <p>
        Respondents could pick more than one, so these do not total 100%. Nobody chose real-time
        tracking, the feature most telematics insurers lead with.
      </p>
      <ul>
        {PRIORITIES.map((p) => (
          <li key={p.label}>
            <strong>{p.label}</strong> - {pct(p.count)}%
          </li>
        ))}
      </ul>

      <h2>What would you want instead?</h2>
      <p>Answered in their own words, quoted unedited:</p>
      <ul>
        {WISHES.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>

      <h2>Method, and how much this proves</h2>
      <p>
        Not much on its own, and we would rather say so than dress it up. The survey ran between{' '}
        {SURVEY.from} and {SURVEY.to} and drew {SURVEY.n} respondents. That is a signal we used to
        decide what to build first, not evidence about the market.
      </p>
      <p>
        It was collected through an open link with no identity check, so we cannot present it as a
        UK sample. Only two respondents were aged 18 to 24, so it is not a sample of the drivers
        Driiva is built for either.
      </p>
      <p>
        It collected no names and no email addresses, by design. Nobody who answered was added to
        the waitlist or contacted afterwards.
      </p>
    </LegalPage>
  );
}

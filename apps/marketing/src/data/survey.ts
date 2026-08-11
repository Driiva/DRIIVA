/*
 * DRIIVA UX SURVEY - the real numbers, and their provenance.
 * ==========================================================
 *
 * Source: our own "Driiva UX Survey" on SurveyMonkey, an anonymous public web
 * link. 17 responses between 08/07/2025 and 03/08/2025. Read back from the
 * account on 11/08/2026 and cross-checked row by row against SurveyMonkey's
 * own Q3 data table before anything here was published.
 *
 * WHY THE CAVEAT BELOW IS NOT OPTIONAL. Three things are true about this data
 * and all three have to travel with it:
 *
 *   1. n = 17. That is a signal, not a finding, and the copy says so.
 *   2. It is NOT a sample of the people Driiva is built for. Only 2 of the 17
 *      were 18-24; 12 were 25-34. Nothing here may be framed as "young UK
 *      drivers say", because they did not say it.
 *   3. The collector was an open web link with no identity check, and several
 *      respondent IPs resolve to VPN or datacentre ranges, one to Japan. So it
 *      cannot be described as a UK sample either.
 *
 * The survey never asked for a name or an email, so these 17 are not
 * contactable and are not waitlist members. See docs/premium-lift/findings.md.
 *
 * Percentages are computed at render from the counts, never stored, so a count
 * and its percentage cannot drift apart the way the old "117" did.
 */

export const SURVEY = {
  n: 17,
  from: '08/07/2025',
  to: '03/08/2025',
} as const;

export interface Priority {
  readonly label: string;
  readonly count: number;
}

/*
 * Q3, "Which features do you find most valuable? (Select all that apply)".
 * Multi-select, so these sum to 29 across 17 people rather than to 17.
 * Verified against SurveyMonkey's table: 12 / 9 / 4 / 4 / 0.
 */
export const PRIORITIES: readonly Priority[] = [
  { label: 'Customer support', count: 12 },
  { label: 'Usage-based pricing', count: 9 },
  { label: 'Driving behaviour analysis', count: 4 },
  { label: 'Accident detection and alerts', count: 4 },
  { label: 'Real-time tracking', count: 0 },
];

/*
 * Q7, "What improvements or additional features would you like from an
 * insurance provider?". 13 of 17 answered. Quoted verbatim, including the
 * lowercase and the phrasing.
 *
 * Q7 and not Q6. Q6 asked about problems with their current insurer, and 6 of
 * the 15 who answered it said "No", "Not really" or "N/A". Building a wall of
 * grievance quotes out of the angry minority would misrepresent the responses,
 * so the wishlist question is the one that runs. It is also the useful one: it
 * is what people asked for, unprompted.
 */
export const WISHES: readonly string[] = [
  'Actually pay out on time',
  'Money back',
  'Better app design to make things easier',
  'Dynamic pricing',
  'Good customer service, no price rise after a non fault claim',
  'Don’t wait till you threaten to leave to better the deal/price',
];

export const ANSWERED_WISHES = 13;

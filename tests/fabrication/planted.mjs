/**
 * The planted violations the harness checks itself against. Every line here is
 * a fabrication that MUST trip a law; if one stops tripping, the law has gone
 * quiet. Extracted verbatim from tests/fabrication-laws.mjs.
 */

export const PLANTED = `
// A planted file. Every law that reads components must fire on it.
export const badge = 'Driiva Ltd. Authorised and regulated by the Financial Conduct Authority.';
// The paraphrases. The old regulatory-claim law matched none of these, which
// is how "pending FCA authorisation" survived on eight screens for sixteen
// days after the sweep that was meant to have removed it. They are planted
// individually because each is a different way of not saying "authorised".
export const pending = 'Our insurance product is pending FCA authorisation.';
export const awaiting = 'We are awaiting FCA sign-off on the product.';
export const applied = 'Our FCA application is in review.';
export const phase = 'Driiva is in the FCA Regulatory Sandbox application phase.';
export const scale = 'Join thousands of drivers already saving.';
export const money = 'Refunds tracked: £18.4k, paid out within 14 days.';
export const who = 'Test Driver, 0800 123 4567, test@driiva.co.uk';
export const bound = { status: rootPolicy.status || 'active', safety: pool.factor ?? 1.0 };
`;

/**
 * Lines of PLANTED that must each be caught in their own right.
 *
 * "Every law fired at least once" is too weak a plant check for a law with ten
 * alternatives in it: `badge` alone trips regulatory-claim, and the four
 * paraphrases below could all silently stop matching while the planted run
 * still reported that the gate works. That is the same shape as the design:laws
 * plant check that certified a two-thirds-blind gate. So the planted run
 * asserts these BY LINE, not by law.
 */
export const PLANTED_LINES_THAT_MUST_TRIP = [
  ['regulatory-claim', 'pending FCA authorisation'],
  ['regulatory-claim', 'awaiting FCA sign-off'],
  ['regulatory-claim', 'FCA application is in review'],
  ['regulatory-claim', 'Sandbox application phase'],
  ['regulatory-claim', 'Authorised and regulated by the Financial Conduct Authority'],
];

/**
 * The stylesheet half of the planted run. The laws that only read CSS cannot
 * fire on planted.tsx, so proving they work needs their own specimen.
 *
 * The decorative declarations at the bottom are as load-bearing as the
 * violations above them: if the law starts matching those, it is matching
 * every pseudo-element in the codebase and is about to be turned off.
 */
export const PLANTED_CSS = `
/* Violations. Each must be caught. */
.a::before { content: '117+ on the list'; }
.b::after  { content: "Authorised and regulated by the Financial Conduct Authority"; }
.c::before { content: attr(data-claim); }
.d { background-image: url("data:image/svg+xml,%3Csvg%3E%3Ctext%3ETrusted by thousands%3C/text%3E%3C/svg%3E"); }

/* Furniture. None of these may fire, or the law is unusable. */
.e::before { content: ''; }
.f::after  { content: " "; }
.g::before { content: '\\2014'; }
.h::after  { content: '•'; }
.i::before { content: '→'; }
.j { justify-content: space-between; align-content: center; }
`;

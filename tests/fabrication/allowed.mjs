/**
 * Every acknowledged hit, with the reason it is true. Extracted verbatim from
 * tests/fabrication-laws.mjs. Adding an entry here is the intended workflow,
 * not a defeat: the reason is what makes the claim auditable later.
 */

/**
 * Every acknowledged hit, keyed "<file>::<matched text lowercased>".
 * A reason is mandatory. "It is fine" is not a reason.
 */
export const ALLOWED = new Map(Object.entries({
  // ── llms.txt: the regulatory words appear only inside their own denial
  'apps/marketing/public/llms.txt::fca authorised':
    'Every occurrence is a negation. Line 3 "is not FCA authorised", line 10 "Not FCA authorised", line 54 the explicit do-not-say list telling AI systems never to claim it.',
  'apps/marketing/public/llms.txt::fca regulated':
    'Line 54 only, inside "Do not say: that Driiva is FCA authorised, FCA regulated, FCA registered...". The file exists to stop a model asserting this.',
  'apps/marketing/public/llms.txt::registration number':
    'Line 54, instructing AI systems NOT to attribute a company registration number to Driiva from memory. Written because a downloadable policy document once carried the invented number DRV123456.',

  // ── Regulatory language that is correctly conditional or correctly negative
  'client/src/pages/trust.tsx::underwritten by':
    'Future tense: "they will be underwritten by a regulated capacity partner", followed by "No capacity partner is in place today".',
  'client/src/pages/trust.tsx::capacity partner':
    'Same sentence; the page states plainly that there is not one yet.',
  'apps/marketing/src/sections/Footer.tsx::pra-regulated':
    'Fine print, conditional: capital backing "once underwriting begins". This is the wording the rest of the site was aligned TO.',
  'apps/marketing/src/sections/Footer.tsx::underwriting':
    'Same sentence.',
  'apps/marketing/src/sections/Security.tsx::pra-regulated':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/Security.tsx::reinsurance':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/Security.tsx::underwriting':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/TrustRibbon.tsx::pra-regulated':
    'Badge reads "Reinsurance backed / PRA-regulated capital at launch". At launch, not today.',
  'apps/marketing/src/sections/FAQ.tsx::fca-regulated':
    'The question "Are you FCA-regulated?". The answer begins "Not yet."',
  'apps/marketing/src/sections/FAQ.tsx::pra-regulated':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/FAQ.tsx::reinsurer':
    'Conditional, matches the footer.',
  'apps/marketing/src/sections/FAQ.tsx::underwriting':
    'Conditional, matches the footer.',
  'apps/marketing/src/routes/Terms.tsx::we are authorised':
    'Legal page, conditional: "When we are authorised to do so by the FCA".',
  'apps/marketing/src/routes/Terms.tsx::underwriting':
    'Legal page: offers "may be subject to underwriting". Conditional.',
  'apps/marketing/src/routes/Complaints.tsx::we are authorised':
    'Legal page, conditional: "once we are authorised".',
  'apps/marketing/src/routes/Complaints.tsx::fca-authorised':
    'Legal page, conditional: "Until we are FCA-authorised, the FOS route is not yet available".',
  'apps/marketing/src/routes/Privacy.tsx::underwriting':
    'Legal page: "begins underwriting real policies (post FCA Sandbox)". Conditional.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca-authorised':
    'Conditional, and the honest-framing exemplar: "Real pricing happens once we are FCA-authorised".',
  'client/src/pages/profile.tsx::fca-authorised':
    'Empty state: "Driiva cannot issue policies until it is FCA-authorised".',
  'apps/marketing/src/sections/Comparison.tsx::fca-aligned':
    'Aspirational positioning, not a status claim.',
  'apps/marketing/src/sections/Footer.tsx::reinsurer':
    'Same conditional sentence as ::pra-regulated above.',
  'apps/marketing/src/sections/Security.tsx::reinsurer':
    'Same conditional sentence.',
  'apps/marketing/src/sections/TrustRibbon.tsx::reinsurance':
    'Badge label "Reinsurance backed", qualified by "at launch" on the line below.',
  'apps/marketing/src/sections/Pool.tsx::fca-authorised':
    'The illustration label: "Nothing is paid until we are FCA-authorised".',
  'client/src/pages/policy.tsx::fca-authorised':
    'Two honest empty states: cover "cannot issue one until it is FCA-authorised", and refunds "not paid until Driiva is FCA-authorised".',

  // ── The agreed status line, and the sentences that qualify it.
  //
  // These are all hits on the broadened shape above, and they are all TRUE.
  // The agreed wording is "working towards the FCA regulatory sandbox, not
  // authorised, not under an MGA", and a law that matches any FCA-adjacent
  // status word necessarily matches the true sentence as well as the false
  // one. That is the trade the law is making: it cannot tell truth from
  // falsehood, only a human can, so each true one is written down here with
  // the reason it is true rather than being quietly excluded by the regex.
  'client/src/components/BetaEstimateCard.tsx::fca regulatory':
    'The agreed line, on the beta estimate disclaimer: "working towards the FCA regulatory sandbox, not authorised and not operating under an MGA". Reconciled 26 Aug after it had reverted to the stronger "pending FCA authorisation".',
  'client/src/pages/policy.tsx::fca regulatory':
    'Two honest empty states, both conditional: cover "cannot issue one until it is through the FCA regulatory sandbox", refunds the same.',
  'client/src/components/profile/CoverageTypeSection.tsx::fca regulatory':
    'Empty state: "Driiva cannot issue policies until it is through the FCA regulatory sandbox". A statement of what we cannot do. Moved here from client/src/pages/profile.tsx when that page was split.',
  'client/src/pages/terms.tsx::fca regulatory':
    'Legal page, the agreed line in full: "working towards the FCA regulatory sandbox, is not authorised, and is not operating under an MGA".',
  'client/src/pages/trust.tsx::fca sandbox':
    'Badge label "Working towards FCA sandbox". Towards, not in.',
  'client/src/pages/trust.tsx::fca regulatory':
    'The agreed line, twice, each followed by the explicit denial: "We are not authorised by the FCA, we are not operating under an MGA, and we cannot sell".',
  'apps/marketing/src/routes/Complaints.tsx::fca regulatory':
    'Legal page, conditional: the FOS route opens "when Driiva is through the FCA regulatory sandbox and able to sell motor insurance". Not yet.',
  'apps/marketing/src/routes/Privacy.tsx::fca sandbox':
    'Legal page, conditional and future tense: a product privacy notice arrives "when Driiva begins underwriting real policies (post FCA Sandbox)".',
  'apps/marketing/src/routes/Terms.tsx::fca regulatory':
    'The agreed line on the Terms page, followed by "We are not authorised to issue motor insurance".',
  'apps/marketing/src/sections/BetaCountdown.tsx::fca sandbox':
    'A source comment noting the beta target date moves with the sandbox milestone. Not rendered, and not a claim about status.',
  'apps/marketing/src/sections/FAQ.tsx::fca authorises':
    'Answer to "What happens if I have an accident?": "Nothing yet, because we cannot sell you a policy until the FCA authorises us." The FCA has not.',
  'apps/marketing/src/sections/FAQ.tsx::fca regulatory':
    'The agreed line as the answer to "Are you FCA-regulated?", which begins "Not yet."',
  'apps/marketing/src/sections/Footer.tsx::fca regulatory':
    'Site-wide fine print, the agreed line: "working towards the FCA regulatory sandbox and is not yet authorised to issue motor insurance policies".',
  'apps/marketing/src/sections/Pool.tsx::fca sandbox':
    'Illustration label: "Nothing is paid until we are through the FCA sandbox", under an explicit "Illustration, not a quote" heading.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca sandbox':
    'Source comment: real underwriting "will replace this once Driiva is through the FCA sandbox". Future tense, not rendered.',
  'apps/marketing/src/sections/ScoreCalculator.tsx::fca regulatory':
    'The honest-framing exemplar: "Real pricing happens once we are through the FCA regulatory sandbox and we score your actual driving".',
  'apps/marketing/api/lib/waitlist-core.ts::fca regulatory':
    'The agreed line in the confirmation email that goes to real signups, in both the HTML and the plain-text part: "working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer." This file is why the law exists; it once emailed real people that Driiva was in the "FCA Regulatory Sandbox application phase".',
  // ── Mobile, in scope since 26 Aug 2026
  'mobile/app/(tabs)/community.tsx::fca regulatory':
    'Header comment explaining why no pound figure may appear against the pool: the company is "only working towards the FCA regulatory sandbox and is not authorised". Not rendered.',
  'mobile/app/(tabs)/profile.tsx::fca regulatory':
    'The settings legal line, the agreed wording in its shortest form: "Working towards the FCA regulatory sandbox, not authorised, not operating under an MGA".',
  'mobile/app/(tabs)/rewards.tsx::fca regulatory':
    'Rewards disclaimer, the agreed line plus "Nothing on this screen is a binding offer".',
  'mobile/app/onboarding/account.tsx::fca regulatory':
    'The agreed line on the Shariah badge. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/comparison.tsx::fca regulatory':
    'The agreed line on the comparison callout. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/index.tsx::fca regulatory':
    'The agreed line on the first onboarding screen. Was "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/quote.tsx::fca regulatory':
    'The agreed line twice: on the quote stub and on the refund-estimate disclaimer. Both were "pending FCA authorisation" until 26 Aug.',
  'mobile/app/onboarding/social-proof.tsx::fca regulatory':
    'The agreed line on the disclaimer under the principles list.',
  'mobile/app/trust.tsx::fca regulatory':
    'The financial-promotion disclaimer, the agreed line: "working towards the FCA regulatory sandbox and is not authorised".',
  'mobile/app/trust.tsx::we are authorised':
    'Conditional: "When we are authorised to distribute policies". Same construction as the already-acknowledged apps/marketing/src/routes/Terms.tsx.',
  'mobile/app/trust.tsx::underwritten by':
    'Future tense since 26 Aug: "When we are authorised to distribute policies, they will be underwritten by a regulated capacity partner". The screen previously said policies ARE underwritten by our capacity partner, in the present tense, on a product with no insurer and no partner. Matched to the wording already on client/src/pages/trust.tsx.',
  'mobile/app/trust.tsx::capacity partner':
    'Same sentence, and the paragraph now ends "No capacity partner is in place today".',
  "mobile/app/trips/[tripId].tsx::?? 'unknown'":
    'A trip whose route will not resolve a start or end place has no known start or end place. "Unknown" is the fact, not a stand-in for it. Same case as the already-acknowledged client/src/hooks/useDashboardData.ts.',

  'apps/marketing/public/llms.txt::fca regulatory':
    'The machine-readable summary states the position three times and each is the agreed line or its denial: line 3 "working towards the FCA regulatory sandbox, is not FCA authorised, is not operating under an MGA", line 10 the regulatory-position list, line 53 the do-say list.',

  // ── Placeholders that are correct
  'client/src/pages/forgot-password.tsx::example.com':
    'Input placeholder "you@example.com". example.com is the reserved documentation domain; it cannot reach a real person.',
  'client/src/pages/signin.tsx::example.com':
    'Input placeholder.',
  'client/src/pages/signup.tsx::example.com':
    'Input placeholder.',
  'apps/marketing/src/routes/Complaints.tsx::0800 023 4567':
    'The real Financial Ombudsman Service number, alongside their real address at Exchange Tower, London E14 9SR. Verified against financial-ombudsman.org.uk being cited in the same list.',
  // ── Fallbacks that stand in for something genuinely unknown, which is the
  // opposite of a confident stand-in
  "client/src/hooks/useDashboardData.ts::|| 'unknown'":
    'A trip whose routeSummary will not split has no known start or end place. "Unknown" is the fact.',
  "client/src/pages/admin/monitoring.tsx::|| 'unknown'":
    'Admin health panel: a check that reported nothing is of unknown status. Admin-only, and accurate.',
  'server/seed.ts::test@d':
    'Local seed script, never imported by the server. The seed data itself is a reported HIGH finding (fabricated pool and refund), tracked separately; this entry only acknowledges the address.',

  // ── Money on rendered surfaces
  'apps/marketing/src/sections/Pool.tsx::£840':
    'Worked example under an explicit "Illustration, not a quote" label.',
  'apps/marketing/src/sections/Pool.tsx::£150':
    'Same illustration.',
  'apps/marketing/src/sections/Pool.tsx::£30':
    'Same illustration.',
  'apps/marketing/src/sections/Pool.tsx::£180':
    'Same illustration.',
  'client/src/components/ui/Readout.tsx::£12.40':
    'Component documentation example in a doc comment, not rendered.',
  'client/src/components/ui/Readout.tsx::£1,204.50':
    'Component documentation example in a doc comment, not rendered.',
  'client/src/components/profile/CoverageTypeSection.tsx::£20m':
    'The Wave G comment recording why the benefit list is now gated, and the benefit line itself, which renders only behind a real coverageType. Moved here from client/src/pages/profile.tsx when that page was split.',
  'client/src/components/profile/CoverageTypeSection.tsx::£100,000':
    'The same Wave G comment and the same coverageType gate.',

  // ── Copy printed from a stylesheet
  'apps/marketing/src/styles/global.css::typical':
    'The comparison table drops its header row under 760px, so each cell labels its own column. "Typical" is the mobile-width form of the desktop header "Traditional UK insurer". It names a column, it does not claim anything about a competitor. Its sibling label is the drawn wordmark as a background image, not type.',
}));

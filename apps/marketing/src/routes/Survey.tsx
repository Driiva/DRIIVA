import { LegalPage } from './LegalPage';

export function Survey() {
  return (
    <LegalPage title="Help shape Driiva" updated="2026-05-19">
      <p className="legal-lede">
        We want the first refund-first motor insurer in the UK to be built with drivers, not at
        them. Thirty seconds of your time changes what we ship first. Anonymous, no marketing,
        no follow-ups unless you opt in.
      </p>

      <div className="legal-survey-embed">
        <p>
          <strong>The survey runs on a separate form host.</strong> When the link is live this
          card will embed it inline. For now, write to{' '}
          <a href="mailto:hello@driiva.co.uk?subject=Driiva survey">hello@driiva.co.uk</a> and
          we'll send you the questions directly.
        </p>
      </div>
    </LegalPage>
  );
}

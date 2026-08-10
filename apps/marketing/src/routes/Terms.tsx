import { LegalPage } from './LegalPage';

export function Terms() {
  return (
    <LegalPage title="Terms" updated="2026-05-19">
      <p className="legal-lede">
        These terms govern your use of driiva.co.uk and the Driiva waitlist. Driiva is not yet
        selling motor insurance. When we are authorised to do so by the FCA, a separate policy
        contract will apply.
      </p>

      <h2>1. About these terms</h2>
      <p>
        These terms form a contract between you and Driiva Technologies Ltd. By using this site or
        joining the waitlist you agree to them.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The waitlist is open to UK residents aged 17 or over. Joining the waitlist does not
        guarantee a policy will be offered, and offers may be subject to underwriting.
      </p>

      <h2>3. The waitlist is not a policy</h2>
      <p>
        Driiva is working towards the FCA regulatory sandbox. We are not authorised
        to issue motor insurance. The waitlist exists to gauge interest, share product updates,
        and notify you when the beta opens. No premium is collected, no cover is in force.
      </p>

      <h2>4. Acceptable use</h2>
      <ul>
        <li>Do not attempt to disrupt the site or its infrastructure.</li>
        <li>Do not submit false or misleading information.</li>
        <li>Do not scrape, copy, or republish site content without our written consent.</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        The Driiva name, wordmark, scoring algorithm, written content, illustrations, and code are
        owned by Driiva Technologies Ltd. or licensed to us. We publish the scoring algorithm
        openly under a permissive licence; everything else is reserved unless explicitly stated.
      </p>

      <h2>6. Disclaimer and liability</h2>
      <p>
        The site is provided on an "as is" basis. To the fullest extent permitted by law, Driiva
        is not liable for indirect or consequential losses arising from your use of the site or
        the waitlist. Nothing in these terms limits our liability for fraud or anything we are not
        permitted by law to limit.
      </p>

      <h2>7. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales. The courts of England and Wales
        have exclusive jurisdiction over any dispute.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these terms. Material changes will be communicated to people on the waitlist
        by email.
      </p>
    </LegalPage>
  );
}

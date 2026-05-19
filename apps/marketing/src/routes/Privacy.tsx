import { LegalPage } from './LegalPage';

export function Privacy() {
  return (
    <LegalPage title="Privacy" updated="2026-05-19">
      <p className="legal-lede">
        Your data is as private as it should be. This page explains what we collect on the
        marketing site and the waitlist, how we use it, and what choices you have. When Driiva
        begins underwriting real policies (post FCA Sandbox), a separate product privacy notice
        will cover driving data and claims information.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Driiva Technologies Ltd. is a UK company registered in England and Wales. We are the data
        controller for personal information collected on driiva.co.uk. Contact:{' '}
        <a href="mailto:hello@driiva.co.uk">hello@driiva.co.uk</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Waitlist signups:</strong> email address and the timestamp of signup.
        </li>
        <li>
          <strong>Site analytics:</strong> aggregated page views and basic device/browser data via
          Plausible. No cookies, no IP storage, no cross-site tracking.
        </li>
        <li>
          <strong>Error logs:</strong> anonymised exception data via Sentry to keep the site
          reliable.
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <ul>
        <li>To email you when the beta opens and to share material product updates.</li>
        <li>To understand how the site is performing in aggregate.</li>
        <li>We do not sell, rent, or share your data with advertisers.</li>
      </ul>

      <h2>4. Your rights under UK GDPR</h2>
      <ul>
        <li>
          <strong>Access:</strong> request a copy of the data we hold on you.
        </li>
        <li>
          <strong>Deletion:</strong> request erasure of your data. We comply within 30 days.
        </li>
        <li>
          <strong>Portability:</strong> get your data in a machine-readable format.
        </li>
        <li>
          <strong>Withdraw consent:</strong> unsubscribe from emails or ask us to remove you from
          the waitlist at any time.
        </li>
      </ul>
      <p>
        Exercise any of these by emailing{' '}
        <a href="mailto:hello@driiva.co.uk">hello@driiva.co.uk</a>. You also have the right to
        complain to the Information Commissioner's Office (ico.org.uk).
      </p>

      <h2>5. Retention</h2>
      <p>
        Waitlist emails are retained until you ask us to delete them or until 24 months after the
        beta closes, whichever is sooner. Aggregated analytics are kept for up to 36 months.
      </p>

      <h2>6. Security</h2>
      <p>
        Data is encrypted at rest (AES-256) and in flight (TLS 1.3). We use UK-sovereign hosting
        wherever possible and audit our suppliers annually. If we ever discover a personal-data
        breach, we will notify you and the ICO within 72 hours where required.
      </p>

      <h2>7. Changes</h2>
      <p>
        We will update this page if our practices change. Material changes will be communicated to
        people on the waitlist by email.
      </p>
    </LegalPage>
  );
}

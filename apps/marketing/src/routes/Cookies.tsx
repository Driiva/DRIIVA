import { LegalPage } from './LegalPage';

export function Cookies() {
  return (
    <LegalPage title="Cookies" updated="2026-05-19">
      <p className="legal-lede">
        We use the smallest possible amount of cookies and tracking. This page lists what runs on
        the site, why, and how to opt out.
      </p>

      <h2>1. What we use</h2>
      <ul>
        <li>
          <strong>Strictly necessary:</strong> a single first-party preference cookie storing your
          choice about analytics and your dismissal of this banner. No third party sees it.
        </li>
        <li>
          <strong>Analytics (Plausible):</strong> cookieless. Plausible counts page views in
          aggregate without setting cookies, storing IPs, or tracking you across sites.
        </li>
      </ul>

      <h2>2. What we do not use</h2>
      <ul>
        <li>No Google Analytics, Meta Pixel, TikTok Pixel, or similar trackers.</li>
        <li>No advertising or remarketing cookies.</li>
        <li>No cross-site identifiers.</li>
      </ul>

      <h2>3. Manage your preference</h2>
      <p>
        Open this page on any device to update your choice. You can also clear the
        <code>driiva.cookie.consent</code> entry from your browser's site data to be re-prompted.
      </p>

      <h2>4. Browser controls</h2>
      <p>
        Every modern browser lets you clear or block cookies for any site. The Information
        Commissioner's Office (ico.org.uk) publishes plain-English guidance on how to do this in
        Chrome, Safari, Edge, and Firefox.
      </p>
    </LegalPage>
  );
}

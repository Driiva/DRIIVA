import { LegalPage } from './LegalPage';

export function Cookies() {
  return (
    <LegalPage title="Cookies" updated="2026-05-27">
      <p className="legal-lede">
        We set no cookies. This page lists the little that does run on the site, why, and how to
        control it.
      </p>

      <h2>1. What we use</h2>
      <ul>
        <li>
          <strong>Analytics (Vercel Web Analytics):</strong> cookieless. Counts page views and
          custom events in aggregate without setting cookies, storing IPs, or tracking you across
          sites. Because it sets no cookies and stores nothing on your device, it needs no consent
          under UK PECR, so there is no cookie banner.
        </li>
      </ul>

      <h2>2. What we do not use</h2>
      <ul>
        <li>No Google Analytics, Meta Pixel, TikTok Pixel, or similar trackers.</li>
        <li>No advertising or remarketing cookies.</li>
        <li>No cross-site identifiers.</li>
      </ul>

      <h2>3. Browser controls</h2>
      <p>
        Every modern browser lets you clear or block cookies for any site. The Information
        Commissioner's Office (ico.org.uk) publishes plain-English guidance on how to do this in
        Chrome, Safari, Edge, and Firefox.
      </p>
    </LegalPage>
  );
}

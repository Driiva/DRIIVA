import { useEffect, useState } from 'react';
import { Link } from 'wouter';

const STORAGE_KEY = 'driiva.cookie.consent';

type Consent = 'accepted' | 'rejected' | null;

function readConsent(): Consent {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'rejected') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function writeConsent(c: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsent(readConsent());
  }, []);

  if (!mounted || consent !== null) return null;

  function accept() {
    writeConsent('accepted');
    setConsent('accepted');
  }
  function reject() {
    writeConsent('rejected');
    setConsent('rejected');
  }

  return (
    <div className="cookie-banner glass" role="dialog" aria-label="Cookie preferences" aria-live="polite">
      <div className="cookie-banner-body">
        <p>
          We use a single first-party preference cookie and cookieless Plausible analytics. No
          advertising trackers, no cross-site identifiers.
        </p>
        <p className="cookie-banner-link">
          <Link href="/cookies">Read the cookie policy</Link>
        </p>
      </div>
      <div className="cookie-banner-actions">
        <button type="button" className="cookie-banner-secondary" onClick={reject}>
          Reject non-essential
        </button>
        <button type="button" className="cookie-banner-primary" onClick={accept}>
          Accept all
        </button>
      </div>
    </div>
  );
}

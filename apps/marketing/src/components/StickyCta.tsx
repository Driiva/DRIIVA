import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useWaitlistCount } from '@/hooks/useWaitlistCount';

const SHOW_AFTER_PX = 600;

export function StickyCta() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitlistCount = useWaitlistCount();

  useEffect(() => {
    if (location !== '/') {
      setVisible(false);
      return;
    }
    function onScroll() {
      if (dismissed) return;
      const y = window.scrollY;
      const nearEnd =
        window.innerHeight + y >= document.documentElement.scrollHeight - 800;
      // Show after the user has moved past the hero, hide near the FinalCTA
      // so we never compete with the in-page form.
      setVisible(y > SHOW_AFTER_PX && !nearEnd);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [location, dismissed]);

  if (location !== '/') return null;

  function scrollToForm() {
    const el = document.querySelector('#cta-final');
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <div
      className={`sticky-cta${visible && !dismissed ? ' is-visible' : ''}`}
      role="region"
      aria-label="Join the Driiva waitlist"
    >
      <div className="sticky-cta-inner">
        <span className="sticky-cta-dot" aria-hidden="true" />
        <span className="sticky-cta-text">
          {waitlistCount === null ? (
            'Join the waitlist. Beta opens September.'
          ) : (
            <>
              <strong>{waitlistCount.toLocaleString('en-GB')} drivers</strong> on the waitlist. Beta
              opens September.
            </>
          )}
        </span>
        <button type="button" className="sticky-cta-button" onClick={scrollToForm}>
          Join the waitlist
        </button>
        <button
          type="button"
          className="sticky-cta-close"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

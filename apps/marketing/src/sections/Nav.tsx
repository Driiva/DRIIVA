import { type MouseEvent, useEffect, useState } from 'react';
import { useLocation } from 'wouter';

interface NavLink {
  href: string;
  label: string;
}

const LINKS: readonly NavLink[] = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#about', label: 'About us' },
  { href: '#security', label: 'Security' },
] as const;

const SCRIM_AFTER_PX = 40;

function smoothScrollTo(target: string) {
  if (!target || target === '#') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.querySelector(target);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

export function Nav() {
  const [location, setLocation] = useLocation();
  const onHome = location === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCRIM_AFTER_PX);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleAnchor(e: MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    if (!onHome) {
      // From any other route, jump home with the hash so the browser
      // scrolls to the section on load.
      setLocation('/');
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = href.startsWith('#') ? href : '#' + href;
          smoothScrollTo(target);
        });
      });
      return;
    }
    smoothScrollTo(href);
  }

  function handleHome(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (!onHome) {
      setLocation('/');
      return;
    }
    smoothScrollTo('#');
  }

  return (
    <nav className={`nav-pill${scrolled ? ' is-scrolled' : ''}`} aria-label="Primary">
      <div className="nav-scrim" aria-hidden="true" />
      <a href="/" className="nav-pill-logo" aria-label="Driiva home" onClick={handleHome}>
        <img src="/brand/logo-wordmark-white-v3.png" alt="Driiva" width="106" height="28" />
      </a>
      <div className="nav-links">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={onHome ? l.href : '/' + l.href}
            className="nav-link"
            onClick={(e) => handleAnchor(e, l.href)}
          >
            {l.label}
          </a>
        ))}
      </div>
      <a
        href={onHome ? '#cta-final' : '/#cta-final'}
        className="nav-pill-cta"
        onClick={(e) => handleAnchor(e, '#cta-final')}
        data-testid="nav-cta"
      >
        Join the waitlist
      </a>
    </nav>
  );
}

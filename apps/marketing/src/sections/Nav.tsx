import { useEffect, useState, type MouseEvent } from 'react';

interface NavLink {
  href: string;
  label: string;
}

const LINKS: readonly NavLink[] = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#pool', label: 'The Pool' },
  { href: '#security', label: 'Security' },
  { href: '#about', label: 'About' },
  { href: '#faq', label: 'FAQ' },
] as const;

function smoothScrollTo(target: string) {
  const el = document.querySelector(target);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
  window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function handleAnchor(e: MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    setMenuOpen(false);
    smoothScrollTo(href);
  }

  return (
    <>
      <nav className={`nav${scrolled ? ' scrolled' : ''}`} aria-label="Primary">
        <a href="#" className="nav-logo" aria-label="Driiva home" onClick={(e) => handleAnchor(e, '#')}>
          <img src="/brand/driiva-logo-white.png" alt="Driiva" />
        </a>
        <div className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link" onClick={(e) => handleAnchor(e, l.href)}>
              {l.label}
            </a>
          ))}
        </div>
        <a
          href="#cta-final"
          className="nav-cta"
          onClick={(e) => handleAnchor(e, '#cta-final')}
          data-testid="nav-cta"
        >
          Join Waitlist
        </a>
        <button
          type="button"
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </nav>

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`} role="menu" aria-hidden={!menuOpen}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} role="menuitem" onClick={(e) => handleAnchor(e, l.href)}>
            {l.label}
          </a>
        ))}
        <a
          href="#cta-final"
          role="menuitem"
          className="nav-cta"
          onClick={(e) => handleAnchor(e, '#cta-final')}
        >
          Join Waitlist
        </a>
      </div>
    </>
  );
}

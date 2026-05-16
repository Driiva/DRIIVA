import { type MouseEvent } from 'react';

interface NavLink {
  href: string;
  label: string;
}

const LINKS: readonly NavLink[] = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#about', label: 'About Us' },
  { href: '#security', label: 'Security' },
] as const;

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
  function handleAnchor(e: MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    smoothScrollTo(href);
  }

  return (
    <>
      <a href="#" className="nav-mark" aria-label="Driiva home" onClick={(e) => handleAnchor(e, '#')}>
        <img src="/brand/logo-ii-mark.png" alt="" />
      </a>
      <nav className="nav" aria-label="Primary">
        <div className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="nav-link" onClick={(e) => handleAnchor(e, l.href)}>
              {l.label}
            </a>
          ))}
        </div>
      </nav>
      <a
        href="#cta-final"
        className="nav-cta-right"
        onClick={(e) => handleAnchor(e, '#cta-final')}
        data-testid="nav-cta"
      >
        Join Waitlist
      </a>
    </>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

export function LegalPage({ title, updated, children }: LegalPageProps) {
  // The document title is owned by useRouteMeta in App, driven by the same
  // route table the prerender uses. Setting it here too would overwrite the
  // prerendered title with a different string on every legal page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [title]);

  return (
    <main id="main-content" className="legal-page">
      <div className="container legal-shell">
        <Link href="/" className="legal-back">
          ← Back to Driiva
        </Link>
        <header className="legal-head">
          <h1 className="legal-title">{title}.</h1>
          <p className="legal-meta">Last updated {updated}</p>
        </header>
        <div className="legal-prose">{children}</div>
      </div>
    </main>
  );
}

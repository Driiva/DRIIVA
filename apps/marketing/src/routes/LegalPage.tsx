import { useEffect, type ReactNode } from 'react';
import { Link } from 'wouter';

interface LegalPageProps {
  title: string;
  /**
   * Omitted by pages that are not documents. The 404 reuses this shell for its
   * chrome and was stamping "Last updated 2026-05-19" on itself, which reads as
   * a revision date for a page that has no content to revise.
   */
  updated?: string;
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
          {updated ? <p className="legal-meta">Last updated {updated}</p> : null}
        </header>
        <div className="legal-prose">{children}</div>
      </div>
    </main>
  );
}

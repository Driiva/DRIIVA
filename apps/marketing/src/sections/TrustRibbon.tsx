import { useReveal } from '@/hooks/useReveal';

interface RibbonItem {
  label: string;
  body: string;
  icon: 'shield' | 'lock' | 'code' | 'capital';
}

const ITEMS: readonly RibbonItem[] = [
  {
    icon: 'capital',
    label: 'Reinsurance backed',
    body: 'PRA-regulated capital at launch',
  },
  {
    icon: 'lock',
    label: 'AES-256 / TLS 1.3',
    body: 'UK-sovereign hosting',
  },
  {
    icon: 'code',
    label: 'Open algorithm',
    body: 'Every factor published',
  },
];

function Icon({ name }: { name: RibbonItem['icon'] }) {
  switch (name) {
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'lock':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'capital':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}

export function TrustRibbon() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="trust-ribbon" data-section="trust-ribbon" aria-label="Regulatory and security signals">
      <div className="container">
        <div className="trust-ribbon-inner reveal-init">
          {ITEMS.map((item) => (
            <div key={item.label} className="trust-ribbon-item">
              <span className="trust-ribbon-icon" aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              <span className="trust-ribbon-text">
                <span className="trust-ribbon-label">{item.label}</span>
                <span className="trust-ribbon-body">{item.body}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The "Demo Mode" marker.
 *
 * The same markup was pasted into four files (AuthHeader, dashboard, trips and
 * achievements), and all four were wrong in the same two ways: a rounded-full
 * capsule, which is the one shape this product does not use, and emerald,
 * which on this palette means a score has been earned. Being in demo mode is
 * neither an achievement nor a warning, so it takes the muted voice and the
 * card radius, like every other non-signal on the screen.
 */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block mt-1 px-2 py-1 text-xs ${className}`}
      style={{
        borderRadius: 'var(--radius-sm)',
        background: 'var(--app-surface-2)',
        border: '1px solid var(--app-border)',
        color: 'var(--app-text-sec)',
      }}
    >
      Demo mode
    </span>
  );
}

export default DemoBadge;

/**
 * ErrorBoundary - root and route level.
 *
 * The fallback is deliberately calm and honest. It does not apologise at
 * length, it does not invent a cause, and it never renders placeholder data in
 * place of the thing that failed. It says what happened, offers the one action
 * that can help, and gets out of the way.
 *
 * Root level catches anything the route boundaries miss and offers a reload.
 * Route level keeps the failure inside the page so the nav and the shell
 * survive, and offers a retry that remounts just that subtree.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { captureError } from '@/lib/sentry';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Named in the fallback copy so the reader knows what did not load. */
  name?: string;
  /** Root boundaries offer a reload rather than a retry. */
  level?: 'root' | 'route';
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, {
      componentStack: info.componentStack,
      boundary: this.props.name ?? this.props.level ?? 'route',
    });
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback, name, level = 'route' } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.retry);

    return (
      <ErrorFallback
        error={error}
        name={name}
        level={level}
        onRetry={level === 'root' ? () => window.location.reload() : this.retry}
      />
    );
  }
}

function ErrorFallback({
  error,
  name,
  level,
  onRetry,
}: {
  error: Error;
  name?: string;
  level: 'root' | 'route';
  onRetry: () => void;
}) {
  const what = name ? `${name} could not load.` : 'This part of the app could not load.';

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center px-6 ${
        level === 'root' ? 'min-h-screen' : 'py-16'
      }`}
      style={{ background: level === 'root' ? 'var(--app-bg)' : 'transparent' }}
    >
      <span
        className="inline-flex h-14 w-14 items-center justify-center mb-5"
        style={{
          borderRadius: 'var(--radius-card)',
          background: 'rgba(239, 68, 68, 0.10)',
          boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.22)',
        }}
      >
        <AlertTriangle size={24} strokeWidth={2} style={{ color: 'var(--err)' }} aria-hidden="true" />
      </span>

      <h2 className="font-display text-xl mb-2" style={{ color: 'var(--app-text-hero)' }}>
        {what}
      </h2>
      <p className="text-[15px] leading-relaxed max-w-sm mb-6" style={{ color: 'var(--app-text-sec)' }}>
        Nothing has been lost. Your trips and score are safe on the server, and the
        error has been reported.
      </p>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 text-[14px] font-medium transition-transform active:scale-[0.97]"
        style={{
          borderRadius: 'var(--radius-button)',
          background: 'var(--app-primary)',
          color: 'var(--app-text-hero)',
          transitionTimingFunction: 'var(--spring)',
        }}
      >
        <RotateCw size={16} strokeWidth={2} aria-hidden="true" />
        {level === 'root' ? 'Reload Driiva' : 'Try again'}
      </button>

      {import.meta.env.DEV && (
        <pre
          className="mt-6 max-w-full overflow-x-auto text-left text-[11px] font-mono px-4 py-3"
          style={{
            borderRadius: 'var(--radius-md)',
            background: 'var(--app-surface-1)',
            color: 'var(--app-text-mut)',
            border: '1px solid var(--app-border)',
          }}
        >
          {error.message}
        </pre>
      )}
    </div>
  );
}

export default ErrorBoundary;

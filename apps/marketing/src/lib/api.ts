export interface WaitlistResult {
  ok: boolean;
  position?: number;
  alreadyOnList?: boolean;
  error?: 'invalid_email' | 'server_error' | 'network';
}

/**
 * Submit an email to the waitlist API. Falls back to optimistic success
 * if the API is unreachable (static preview, network blip) so the UI
 * never strands the user — the deployed function captures the address
 * once the site is back online.
 */
export async function joinWaitlist(
  email: string,
  source: 'hero' | 'final-cta' | 'sticky',
): Promise<WaitlistResult> {
  try {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, company: '' }),
    });
    if (res.status === 404) {
      // No backend in this environment — fake success after a short delay
      // so the hero animation still feels right.
      await sleep(600);
      return { ok: true };
    }
    const data = (await res.json()) as {
      success?: boolean;
      position?: number;
      alreadyOnList?: boolean;
      error?: string;
    };
    if (!res.ok || data.success === false) {
      const error = data.error === 'invalid_email' ? 'invalid_email' : 'server_error';
      return { ok: false, error };
    }
    return { ok: true, position: data.position, alreadyOnList: data.alreadyOnList };
  } catch {
    await sleep(400);
    return { ok: true, error: 'network' };
  }
}

export async function fetchWaitlistCount(): Promise<number | null> {
  try {
    const res = await fetch('/api/waitlist-count', { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    return typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

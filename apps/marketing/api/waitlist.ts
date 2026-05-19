import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processWaitlist } from './lib/waitlist-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }
  const body =
    typeof req.body === 'string' ? safeJsonParse(req.body) : (req.body ?? {});
  // Honeypot — silently accept and ignore obvious bot fills
  if (body && typeof body === 'object' && 'company' in body && body.company) {
    return res.status(200).json({ success: true });
  }
  const { status, payload } = await processWaitlist(body ?? {});
  return res.status(status).json(payload);
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

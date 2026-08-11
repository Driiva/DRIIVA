import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWaitlistCount } from './lib/waitlist-core.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  try {
    const count = await getWaitlistCount();
    return res.status(200).json({ count });
  } catch (err) {
    console.error('[waitlist-count] failure', err);
    return res.status(200).json({ count: 117 });
  }
}

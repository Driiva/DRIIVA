import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWaitlistCount } from './lib/waitlist-core.js';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  try {
    // null when the store cannot be reached. The client omits the claim
    // entirely rather than printing a number, which is why this must not
    // invent one.
    const count = await getWaitlistCount();
    return res.status(200).json({ count });
  } catch (err) {
    // This used to answer 117 on failure: a hardcoded figure returned as
    // though it were a reading, from a path that runs precisely when nothing
    // could be read. Fifth place that number has been found.
    console.error('[waitlist-count] failure', err);
    return res.status(200).json({ count: null });
  }
}

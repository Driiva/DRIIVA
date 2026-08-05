/**
 * Single source of truth for per-route title and description.
 *
 * Read twice: by scripts/prerender.mjs at build time (to write the static head
 * of each dist/<route>/index.html) and by the client at runtime (to keep the
 * title correct after a client-side navigation). Keeping one table stops the
 * served title and the JS-set title drifting apart, which would leave Google
 * indexing one string and users seeing another.
 */
export interface RouteMeta {
  path: string;
  title: string;
  desc: string;
}

export const ORIGIN = 'https://driiva.co.uk';

export const ROUTE_META: RouteMeta[] = [
  {
    path: '/',
    title: 'Driiva - car insurance for young UK drivers, no black box',
    desc: 'Car insurance for UK drivers under 25. Your phone scores your driving, safe drivers get the surplus back, and there is no dashcam or dongle to install. Join the beta waitlist.',
  },
  {
    path: '/uk-survey',
    title: 'Help shape Driiva - the UK young driver survey',
    desc: 'Thirty seconds, anonymous, no marketing. Tell us what to build first in the first refund-first motor insurer for young UK drivers.',
  },
  {
    path: '/privacy',
    title: 'Privacy policy',
    desc: 'How Driiva collects, uses and stores your data, what the driving-score app records, and the rights you have over it.',
  },
  {
    path: '/terms',
    title: 'Terms of use',
    desc: 'The terms covering use of the Driiva website and the Driiva beta waitlist.',
  },
  {
    path: '/cookies',
    title: 'Cookie policy',
    desc: 'Which cookies driiva.co.uk sets, what each one does, and how to control them.',
  },
  {
    path: '/complaints',
    title: 'Complaints',
    desc: 'How to raise a complaint with Driiva, what happens next, and the timescales we work to.',
  },
];

/** The homepage title already carries the brand; inner pages get it appended. */
export function fullTitle(meta: RouteMeta): string {
  return meta.path === '/' ? meta.title : `${meta.title} · Driiva`;
}

export function metaForPath(path: string): RouteMeta | undefined {
  const clean = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return ROUTE_META.find((m) => m.path === clean);
}

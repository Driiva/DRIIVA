/**
 * COMMUNITY SUPERSEDES FRIENDS
 * ============================
 * Three things about this change are invisible to a typechecker and would rot
 * silently, so they are asserted here instead.
 *
 * 1. TAB ORDER IS DECLARATION ORDER. expo-router lays the bar out in the order
 *    the <Tabs.Screen> elements appear, so the order is a property of the
 *    source text and nothing else. Reordering two JSX children is a one line
 *    diff that no test would otherwise notice and no type would reject.
 *
 * 2. A REMOVED TAB IS NOT A REMOVED ROUTE. Achievements are reached from the
 *    Community screen and from an achievement_unlocked push notification,
 *    which routes to '/(tabs)/rewards' (mobile/lib/notificationRoutes.ts).
 *    Deleting the file rather than hiding the tab would turn that notification
 *    into a tap that goes nowhere, which is exactly the kind of break that
 *    ships green.
 *
 * 3. NO POUND FIGURE MAY APPEAR ON THE POOL. The money model (D6) is
 *    undefined and addPoolContribution has no callers, so a pool balance in
 *    pounds would be a number nobody has committed to, printed next to an
 *    insurance product from a company that is only working towards the FCA
 *    regulatory sandbox and is not authorised. Participation, share
 *    percentage and the community score are all real and computed; a pound is
 *    not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MOBILE = join(__dirname, '../../mobile');
const read = (rel: string) => readFileSync(join(MOBILE, rel), 'utf8');

const layout = read('app/(tabs)/_layout.tsx');
const community = read('app/(tabs)/community.tsx');
const leaderboard = read('app/leaderboard.tsx');

/**
 * Comments out. A note explaining that "Your circle" replaced "Friends" is the
 * opposite of the problem, and a law that punishes its own explanation trains
 * people to delete the explanation.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * The tabs that actually appear on the bar, in source order. A <Tabs.Screen>
 * carrying `href: null` is registered as a route and drawn nowhere, so it is
 * part of the router and not part of the bar.
 */
function tabOrder(source: string): string[] {
  const declarations = [...source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"([\s\S]*?)\/>/g)];
  return declarations.filter((m) => !m[2].includes('href: null')).map((m) => m[1]);
}

describe('the tab bar', () => {
  it('reads Home, Trips, Drive, Community, You', () => {
    expect(tabOrder(layout)).toEqual(['dashboard', 'trips', 'record', 'community', 'profile']);
  });

  it('names the last tab You rather than Profile', () => {
    expect(layout).toContain("title: 'You'");
    expect(layout).not.toContain("title: 'Profile'");
  });

  it('keeps rewards reachable as a route while taking it off the bar', () => {
    // href: null is expo-router's own way of saying "in the group, not on the
    // bar". The notification route and the Community screen both still land
    // here.
    expect(layout).toMatch(/name="rewards"[\s\S]{0,200}href: null/);
  });
});

describe('the Community screen', () => {
  it('exists and is the tab, not a modal bolted onto the profile', () => {
    expect(community.length).toBeGreaterThan(2000);
  });

  it('carries the four sections in the order the brief sets', () => {
    const pool = community.indexOf('Pool');
    const standing = community.indexOf('Standing');
    const circle = community.indexOf('Your circle');
    const earned = community.indexOf('Earned');

    expect(pool).toBeGreaterThan(-1);
    expect(standing).toBeGreaterThan(pool);
    expect(circle).toBeGreaterThan(standing);
    expect(earned).toBeGreaterThan(circle);
  });

  it('never prints a pound figure against the pool', () => {
    // The pool has no funded balance. A currency symbol here would be a number
    // nobody has committed to, from a company that is not FCA authorised.
    expect(community).not.toContain('£');
    expect(community).not.toContain('formatPounds');
  });

  it('records that the screen was actually looked at', () => {
    expect(community).toContain("track('community_viewed')");
  });
});

describe('the Friends label is gone', () => {
  it('calls the leaderboard scope Your circle', () => {
    expect(leaderboard).toContain('Your circle');
  });

  it('leaves no screen labelled Friends', () => {
    // The product noun, not the English word: "your friend's code" is a person,
    // "the Friends board" was a product surface and that surface is now Your
    // circle.
    for (const [name, source] of [
      ['leaderboard', leaderboard],
      ['community', community],
    ] as const) {
      const labels = [...codeOnly(source).matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)].map(
        (m) => m[1] ?? m[2] ?? '',
      );
      const offenders = labels.filter((l) => /\bfriends?\b/i.test(l) && /^[A-Z]/.test(l));
      expect(offenders, `${name} still labels something Friends: ${offenders.join(', ')}`).toEqual(
        [],
      );
    }
  });
});

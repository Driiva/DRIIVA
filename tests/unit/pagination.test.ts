/**
 * Unit tests for the cursor pagination core (shared/pagination.ts).
 *
 * The behaviour worth pinning is the fetch-one-extra boundary. Every trips
 * surface fetches pageSize + 1 documents and asks splitPage whether the extra
 * one came back. Off by one in either direction is a real user-visible bug:
 * too eager and the list shows a "load more" that returns nothing forever,
 * too shy and the final page of a driver's history is unreachable.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  pageLimit,
  splitPage,
} from '../../shared/pagination';

interface FakeDoc {
  path: string;
}

const pathOf = (d: FakeDoc) => d.path;

function docs(n: number): FakeDoc[] {
  return Array.from({ length: n }, (_, i) => ({ path: `trips/trip-${i}` }));
}

describe('pageLimit', () => {
  it('requests exactly one more document than the page holds', () => {
    expect(pageLimit(25)).toBe(26);
    expect(pageLimit(1)).toBe(2);
    expect(pageLimit()).toBe(DEFAULT_PAGE_SIZE + 1);
  });
});

describe('cursor codec', () => {
  it('round-trips a document path', () => {
    const path = 'trips/8kQxZ2mLpR0vN4tYbC1a';
    expect(decodeCursor(encodeCursor(path))).toBe(path);
  });

  it('round-trips paths of every length modulo 3, covering both padding cases', () => {
    // base64 encodes in 3-byte groups; the 1-byte and 2-byte tails are where a
    // hand-rolled encoder normally loses the final character.
    for (let extra = 0; extra < 6; extra++) {
      const path = `trips/doc${'a'.repeat(extra)}`;
      expect(decodeCursor(encodeCursor(path))).toBe(path);
    }
  });

  it('round-trips non-ASCII path segments', () => {
    const path = 'trips/café-\u{1F1EC}\u{1F1E7}';
    expect(decodeCursor(encodeCursor(path))).toBe(path);
  });

  it('produces URL-safe output with no padding', () => {
    for (let i = 0; i < 40; i++) {
      const encoded = encodeCursor(`trips/subcollection/doc-${'x'.repeat(i)}`);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    }
  });

  it('returns null rather than throwing for values it did not produce', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    // Not base64url at all.
    expect(decodeCursor('not a cursor!')).toBeNull();
    // Decodes cleanly but is not an even-segmented document path.
    expect(decodeCursor(encodeCursor('trips'))).toBeNull();
    expect(decodeCursor(encodeCursor('trips//abc'))).toBeNull();
  });
});

describe('splitPage hasMore boundary', () => {
  const PAGE = 25;

  it('reports no more pages when the collection ends exactly on a page edge', () => {
    // The boundary case: 25 back from a limit of 26 means the 26th did not
    // exist, so this is the last page even though it is completely full.
    const page = splitPage(docs(PAGE), PAGE, pathOf);
    expect(page.items).toHaveLength(PAGE);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('reports another page when the extra document comes back', () => {
    const page = splitPage(docs(PAGE + 1), PAGE, pathOf);
    expect(page.items).toHaveLength(PAGE);
    expect(page.hasMore).toBe(true);
    // The extra document is a probe, never rendered.
    expect(page.items.map(pathOf)).not.toContain('trips/trip-25');
  });

  it('cursors on the last returned item, not the probe, so page 2 starts after it', () => {
    const page = splitPage(docs(PAGE + 1), PAGE, pathOf);
    expect(decodeCursor(page.nextCursor)).toBe('trips/trip-24');
  });

  it('handles a partial final page', () => {
    const page = splitPage(docs(7), PAGE, pathOf);
    expect(page.items).toHaveLength(7);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty collection without inventing a cursor', () => {
    const page = splitPage([], PAGE, pathOf);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('works at a page size of one, where the boundary is tightest', () => {
    expect(splitPage(docs(1), 1, pathOf).hasMore).toBe(false);
    const two = splitPage(docs(2), 1, pathOf);
    expect(two.hasMore).toBe(true);
    expect(two.items).toHaveLength(1);
    expect(decodeCursor(two.nextCursor)).toBe('trips/trip-0');
  });

  it('does not mutate or alias the input array', () => {
    const input = docs(3);
    const page = splitPage(input, PAGE, pathOf);
    expect(input).toHaveLength(3);
    expect(page.items).not.toBe(input);
  });

  it('walks a whole collection in pages with no gaps and no repeats', () => {
    const all = docs(58);
    const seen: string[] = [];
    let cursor: string | null = null;
    let guard = 0;

    do {
      const startPath: string | null = decodeCursor(cursor);
      const startIndex = startPath ? all.findIndex((d) => d.path === startPath) + 1 : 0;
      const fetched = all.slice(startIndex, startIndex + pageLimit(PAGE));
      const page: ReturnType<typeof splitPage<FakeDoc>> = splitPage(fetched, PAGE, pathOf);
      seen.push(...page.items.map(pathOf));
      cursor = page.nextCursor;
    } while (cursor && ++guard < 10);

    expect(seen).toEqual(all.map(pathOf));
    expect(new Set(seen).size).toBe(all.length);
  });
});

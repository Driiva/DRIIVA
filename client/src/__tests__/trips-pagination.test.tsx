/**
 * Proves page two actually loads on the web trips list (Wave C, C4).
 *
 * The boundary arithmetic is covered by tests/unit/pagination.test.ts. What is
 * covered here is the wiring, which is where a cursor implementation usually
 * breaks in practice: that the second request is built with startAfter anchored
 * on the last document of the first page, that the results are appended rather
 * than replacing what is on screen, and that hasMore turns off when a short
 * page comes back so the sentinel stops asking forever.
 *
 * Firestore is mocked at the module boundary rather than run against the
 * emulator because the assertions are about the query the hook constructs and
 * the state it keeps, neither of which a real backend makes more true.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const getDocsMock = vi.fn();
const getDocMock = vi.fn();
const startAfterMock = vi.fn((snap: unknown) => ({ __startAfter: snap }));
const limitMock = vi.fn((n: number) => ({ __limit: n }));

vi.mock('firebase/firestore', () => ({
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  doc: (_db: unknown, path: string) => ({ __doc: path }),
  startAfter: (snap: unknown) => startAfterMock(snap),
  limit: (n: number) => limitMock(n),
  // The hook composes constraints onto a base query; keep them inspectable.
  query: (base: unknown, ...constraints: unknown[]) => ({ __base: base, constraints }),
}));

vi.mock('@/lib/firebase', () => ({
  db: { __db: true },
}));

import { useCursorPagination } from '@/hooks/useCursorPagination';
import { encodeCursor } from '../../../shared/pagination';

interface FakeTrip {
  tripId: string;
}

const PAGE_SIZE = 25;

/** A snapshot the way getDocs returns one: docs carrying a ref path. */
function snapshotOf(ids: string[]) {
  return {
    docs: ids.map((id) => ({
      ref: { path: `trips/${id}` },
      data: () => ({ tripId: id }),
    })),
  };
}

const transform = (d: { data: () => unknown }) => d.data() as FakeTrip;
const baseQuery = { __base: 'trips-ordered' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  getDocMock.mockResolvedValue({ exists: () => true, id: 'cursor-doc' });
});

describe('useCursorPagination', () => {
  it('fetches one more document than the page holds, so hasMore needs no count query', async () => {
    getDocsMock.mockResolvedValue(snapshotOf(Array.from({ length: 10 }, (_, i) => `t${i}`)));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(limitMock).toHaveBeenCalledWith(PAGE_SIZE + 1);
  });

  it('loads page two anchored on the last trip of page one and appends it', async () => {
    const pageOne = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => `page1-${i}`);
    const pageTwo = Array.from({ length: 5 }, (_, i) => `page2-${i}`);
    getDocsMock
      .mockResolvedValueOnce(snapshotOf(pageOne))
      .mockResolvedValueOnce(snapshotOf(pageTwo));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));

    await act(async () => {
      await result.current.loadMore();
    });

    // The probe document is never rendered, and there is more to come.
    await waitFor(() => expect(result.current.items).toHaveLength(PAGE_SIZE));
    expect(result.current.items.map((t) => t.tripId)).not.toContain('page1-25');
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    // Page two continued after the last RENDERED trip of page one, not after
    // the probe. Anchoring on the probe would skip a trip on every page turn.
    const cursorPath = getDocMock.mock.calls[0][0].__doc;
    expect(cursorPath).toBe('trips/page1-24');
    expect(startAfterMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cursor-doc' }),
    );

    // Appended, not replaced.
    await waitFor(() => expect(result.current.items).toHaveLength(PAGE_SIZE + 5));
    expect(result.current.items[0].tripId).toBe('page1-0');
    expect(result.current.items[PAGE_SIZE].tripId).toBe('page2-0');

    // A short page means the history ended, so the sentinel stops asking.
    expect(result.current.hasMore).toBe(false);
  });

  it('continues from the caller-supplied head cursor on the first call only', async () => {
    getDocsMock.mockResolvedValue(snapshotOf(Array.from({ length: PAGE_SIZE + 1 }, (_, i) => `p${i}`)));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    const headCursor = encodeCursor('trips/realtime-head-last');

    await act(async () => {
      await result.current.loadMore(headCursor);
    });
    expect(getDocMock.mock.calls[0][0].__doc).toBe('trips/realtime-head-last');

    // The second call uses the hook's own cursor, not the head again, which
    // would re-fetch the same page forever.
    await act(async () => {
      await result.current.loadMore(headCursor);
    });
    expect(getDocMock.mock.calls[1][0].__doc).toBe('trips/p24');
  });

  it('stops requesting once a page comes back short', async () => {
    getDocsMock.mockResolvedValue(snapshotOf(['only-one']));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.hasMore).toBe(false);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('does not double-append when a fast scroll fires two loads at once', async () => {
    const page = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => `t${i}`);
    getDocsMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(snapshotOf(page)), 20)),
    );

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));

    await act(async () => {
      await Promise.all([result.current.loadMore(), result.current.loadMore()]);
    });

    // The in-flight guard is a ref, so the second call is rejected before any
    // re-render could have told it a request was already running.
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(result.current.items).toHaveLength(PAGE_SIZE);
  });

  it('falls back to the first page when the cursor points at a deleted trip', async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    getDocsMock.mockResolvedValue(snapshotOf(['a', 'b']));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    await act(async () => {
      await result.current.loadMore(encodeCursor('trips/deleted'));
    });

    // No startAfter applied, and the reader gets trips rather than a spinner.
    expect(startAfterMock).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(2);
  });

  it('surfaces a failed page instead of silently showing the end of the list', async () => {
    getDocsMock.mockRejectedValue(new Error('permission-denied'));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    // hasMore stays true: the history did not end, the request failed, and the
    // retry affordance depends on knowing the difference.
    expect(result.current.hasMore).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('drops appended pages on reset so one driver history never stitches onto another', async () => {
    getDocsMock.mockResolvedValue(snapshotOf(Array.from({ length: PAGE_SIZE + 1 }, (_, i) => `t${i}`)));

    const { result } = renderHook(() => useCursorPagination<FakeTrip>(baseQuery, transform, PAGE_SIZE));
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toHaveLength(PAGE_SIZE);

    act(() => {
      result.current.reset();
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(true);

    // And the next load starts from the top again, not from the stale cursor.
    await act(async () => {
      await result.current.loadMore();
    });
    expect(getDocMock).not.toHaveBeenCalled();
  });
});

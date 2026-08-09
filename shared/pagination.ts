/**
 * CURSOR PAGINATION CORE
 * ======================
 * SDK-agnostic half of the cursor pagination used by web trips, admin trips
 * and mobile trips. Ported from the StrydeOS helper
 * (`dashboard/src/lib/firestore-pagination.ts`): a base64url document-path
 * cursor plus the fetch-one-extra trick for `hasMore`.
 *
 * The StrydeOS original is bound to firebase-admin. Driiva needs the same
 * behaviour across three different Firestore SDKs (modular web, admin, and
 * @react-native-firebase on mobile), so the pure part lives here and each
 * surface supplies its own three lines of query wiring:
 *
 *   const snap = await getDocs(query(base, limit(pageLimit(PAGE_SIZE))));
 *   const page = splitPage(snap.docs, PAGE_SIZE, (d) => d.ref.path);
 *
 * Cursors are opaque to callers. They encode a document path rather than a
 * field value so a cursor stays valid when the ordering field is a timestamp
 * shared by several documents, which a value cursor would skip past.
 *
 * base64 is hand-rolled rather than taken from `Buffer` or `btoa`: this module
 * is imported by Node (tests, admin), the browser, and Hermes on mobile, and
 * those three do not agree on which of the two exists.
 */

/** Rows per page. 25 keeps the first trips read well inside the read budget. */
export const DEFAULT_PAGE_SIZE = 25;

const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function utf8String(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i++];
    let code: number;
    if (b0 < 0x80) {
      code = b0;
    } else if (b0 < 0xe0) {
      code = ((b0 & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b0 < 0xf0) {
      code = ((b0 & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      code =
        ((b0 & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    }
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

/** Encodes a document path as an opaque, URL-safe cursor. */
export function encodeCursor(docPath: string): string {
  const bytes = utf8Bytes(docPath);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64URL_ALPHABET[b0 >> 2];
    out += B64URL_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64URL_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64URL_ALPHABET[b2 & 0x3f];
  }
  return out;
}

/**
 * Decodes a cursor back to a document path. Returns null for anything that is
 * not a cursor this module produced, so a tampered or stale query-string value
 * degrades to "first page" instead of throwing at the caller.
 */
export function decodeCursor(cursor: string | null | undefined): string | null {
  if (!cursor) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of cursor) {
    const value = B64URL_ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  if (bytes.length === 0) return null;
  const path = utf8String(bytes);
  // A Firestore document path is always an even number of non-empty segments.
  const segments = path.split('/');
  if (segments.length % 2 !== 0 || segments.some((s) => s.length === 0)) return null;
  return path;
}

export interface Page<T> {
  items: T[];
  /** Pass back to the next query to continue after the last item. */
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * The number of documents to actually request for a page of `pageSize`.
 * One extra: if it comes back, there is at least one more page, and no second
 * count query is needed to know it.
 */
export function pageLimit(pageSize: number = DEFAULT_PAGE_SIZE): number {
  return pageSize + 1;
}

/**
 * Splits a `pageLimit(pageSize)`-sized result into a page.
 *
 * The boundary that matters: exactly `pageSize` documents back means the
 * collection ended precisely on a page edge, so `hasMore` is false and there is
 * no next cursor. Getting this wrong shows the user a spinner that never
 * resolves, or hides the last page entirely.
 */
export function splitPage<T>(
  fetched: readonly T[],
  pageSize: number,
  pathOf: (doc: T) => string,
): Page<T> {
  const hasMore = fetched.length > pageSize;
  const items = hasMore ? fetched.slice(0, pageSize) : fetched.slice();
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(pathOf(last)) : null,
    hasMore,
  };
}

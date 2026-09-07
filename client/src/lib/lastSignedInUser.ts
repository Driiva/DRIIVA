/**
 * The "welcome back" memory: the last driver to sign in on this device, kept
 * in localStorage so the sign-in page can greet them and offer a passkey.
 * Extracted verbatim from client/src/pages/signin.tsx.
 */
export const LAST_USER_KEY = 'driiva-last-user';

export interface LastUserData {
  name: string;
  email: string;
  score?: number;
  lastTrip?: string;
}

/**
 * SIGN-IN PAGE
 * ------------
 * This page handles REAL Firebase authentication only.
 * NO demo accounts - demo mode is accessed via /demo route.
 */

export function getLastUser(): LastUserData | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveLastUser(data: LastUserData) {
  localStorage.setItem(LAST_USER_KEY, JSON.stringify(data));
}

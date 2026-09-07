/**
 * Firebase auth failures, translated into what the driver is told.
 * Extracted verbatim from client/src/pages/signin.tsx, where the same mapping
 * was written out inline in both sign-in paths.
 */

/** The two fields Firebase puts on an auth error, read without trusting either. */
export interface AuthErrorShape {
  code?: string;
  message?: string;
}

/** Narrow an unknown thrown value to the parts these messages read. */
export function asAuthError(error: unknown): AuthErrorShape {
  if (typeof error !== 'object' || error === null) return {};
  const { code, message } = error as { code?: unknown; message?: unknown };
  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
  };
}

/** The message shown when email and password sign-in fails. */
export function passwordSignInMessage(err: AuthErrorShape): string {
  if (err.message?.includes('Sign-in timed out')) {
    return "Sign-in timed out. Please check your connection and try again.";
  }
  if (
    err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key' ||
    err.code === 'auth/api-key-not-valid-please-pass-a-valid-api-key' ||
    err.message?.includes('api-key-not-valid')
  ) {
    return "Service configuration error. The Firebase API key is invalid or restricted.";
  }
  if (err.code === 'auth/invalid-email') {
    return "Invalid email address format.";
  }
  if (
    err.code === 'auth/user-not-found' ||
    err.code === 'auth/wrong-password' ||
    err.code === 'auth/invalid-credential'
  ) {
    return "Invalid email or password. Use one of the test accounts or try demo mode.";
  }
  if (err.code === 'auth/too-many-requests') {
    return "Too many attempts. Please try again later.";
  }
  if (err.code === 'auth/network-request-failed') {
    return "Network error. Check your connection and try again.";
  }
  return "Invalid email or password. Try demo mode if you don't have an account yet.";
}

/** True when the driver simply dismissed the Google popup, which is not a failure. */
export function isDismissedGooglePopup(code: string): boolean {
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

/** The message shown when Google sign-in fails for a reason worth reporting. */
export function googleSignInMessage(code: string): string {
  if (code === 'auth/account-exists-with-different-credential') {
    return "An account already exists with this email using a different sign-in method.";
  }
  if (code === 'auth/network-request-failed') {
    return "Network error. Please check your connection.";
  }
  if (code === 'auth/popup-blocked') {
    return "Pop-up was blocked by your browser. Please allow pop-ups for this site.";
  }
  return "Google sign-in failed. Please try again.";
}

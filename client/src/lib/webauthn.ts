/**
 * WebAuthn utilities for Face ID, Touch ID, and biometric authentication.
 *
 * All API calls use EMAIL (not username) — the backend looks up users by email
 * because Firebase-created accounts have email but nullable username.
 *
 * After successful authentication the server returns a Firebase custom token.
 * The caller is responsible for calling signInWithCustomToken(auth, customToken)
 * to establish a real Firebase session before any protected route is accessed.
 */

import { auth } from './firebase';

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array(Array.from(rawData, c => c.charCodeAt(0))).buffer;
}

// ---------------------------------------------------------------------------
// Device support check
// ---------------------------------------------------------------------------

/**
 * The credential descriptors the server sends inside the options JSON. Only
 * `id` is rewritten here (base64url to ArrayBuffer); everything else is passed
 * through to the browser untouched, so it is carried as-is.
 */
interface CredentialDescriptorJSON {
  id: string;
  [key: string]: unknown;
}

/**
 * The options JSON as it arrives over the wire, before the base64url fields are
 * turned into ArrayBuffers for navigator.credentials.
 */
interface WebAuthnOptionsJSON {
  publicKey: {
    challenge: string | ArrayBuffer;
    user?: { id: string | ArrayBuffer; [key: string]: unknown };
    excludeCredentials?: CredentialDescriptorJSON[];
    allowCredentials?: CredentialDescriptorJSON[];
    [key: string]: unknown;
  };
}

/**
 * The user a successful assertion returns: the server row with the password
 * stripped. Only the fields the client reads are named.
 */
export interface BiometricUser {
  id: string | number;
  firebaseUid?: string | null;
  email: string;
  displayName?: string | null;
  firstName?: string | null;
}

/** The message to show for a thrown value, without assuming it is an Error. */
function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function checkBiometricSupport(): Promise<{
  supported: boolean;
  platformAuthenticator: boolean;
  error?: string;
}> {
  if (!window.PublicKeyCredential) {
    return { supported: false, platformAuthenticator: false, error: 'WebAuthn not supported by this browser' };
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return {
      supported: true,
      platformAuthenticator: available,
      error: available ? undefined : 'Face ID/Touch ID not available on this device',
    };
  } catch {
    return { supported: true, platformAuthenticator: false, error: 'Could not verify biometric support' };
  }
}

// ---------------------------------------------------------------------------
// Pre-login passkey check (public — no auth required)
// ---------------------------------------------------------------------------

export async function checkHasPasskey(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/webauthn/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.hasPasskey;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Registration (requires existing Firebase session)
// ---------------------------------------------------------------------------

export async function registerBiometricCredential(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Enrolment is an authenticated action — the server now gates register/* with
    // requireAuth and derives the account email from the verified token. Attach the
    // current user's Firebase ID token; refuse if there is no live session.
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) {
      return { success: false, error: 'You must be signed in to register a passkey.' };
    }

    const startRes = await fetch('/api/auth/webauthn/register/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email }),
    });
    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(err.message || 'Failed to start registration');
    }

    const options = await startRes.json() as WebAuthnOptionsJSON;
    options.publicKey.challenge = base64UrlToArrayBuffer(options.publicKey.challenge as string);
    if (options.publicKey.user) {
      options.publicKey.user.id = base64UrlToArrayBuffer(options.publicKey.user.id as string);
    }
    if (options.publicKey.excludeCredentials) {
      options.publicKey.excludeCredentials = options.publicKey.excludeCredentials.map((c) => ({
        ...c,
        id: base64UrlToArrayBuffer(c.id) as unknown as string,
      }));
    }

    // The JSON above has been rewritten in place into the ArrayBuffer shape the
    // browser expects; the two types describe the same object either side of
    // that rewrite, which is why this is asserted rather than inferred.
    const credential = await navigator.credentials.create(
      options as unknown as CredentialCreationOptions,
    );
    if (!credential) throw new Error('Failed to create credential');

    const pk = credential as PublicKeyCredential;
    const attestation = pk.response as AuthenticatorAttestationResponse;

    const verifyRes = await fetch('/api/auth/webauthn/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        email,
        credential: {
          id: pk.id,
          rawId: arrayBufferToBase64Url(pk.rawId),
          response: {
            clientDataJSON: arrayBufferToBase64Url(attestation.clientDataJSON),
            attestationObject: arrayBufferToBase64Url(attestation.attestationObject),
          },
          type: pk.type,
        },
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      throw new Error(err.message || 'Failed to verify credential');
    }

    return { success: true };
  } catch (error) {
    console.error('Biometric registration error:', error);
    return { success: false, error: messageFor(error, 'Failed to register biometric authentication') };
  }
}

// ---------------------------------------------------------------------------
// Authentication — returns customToken for signInWithCustomToken()
// ---------------------------------------------------------------------------

export async function authenticateWithBiometrics(email: string): Promise<{
  success: boolean;
  user?: BiometricUser;
  customToken?: string;
  error?: string;
}> {
  try {
    const startRes = await fetch('/api/auth/webauthn/authenticate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(err.message || 'Failed to start authentication');
    }

    const options = await startRes.json() as WebAuthnOptionsJSON;
    options.publicKey.challenge = base64UrlToArrayBuffer(options.publicKey.challenge as string);
    if (options.publicKey.allowCredentials) {
      options.publicKey.allowCredentials = options.publicKey.allowCredentials.map((c) => ({
        ...c,
        id: base64UrlToArrayBuffer(c.id) as unknown as string,
      }));
    }

    // Same rewrite-in-place as registration above.
    const assertion = await navigator.credentials.get(
      options as unknown as CredentialRequestOptions,
    );
    if (!assertion) throw new Error('Failed to get assertion');

    const pk = assertion as PublicKeyCredential;
    const assertionResponse = pk.response as AuthenticatorAssertionResponse;

    const verifyRes = await fetch('/api/auth/webauthn/authenticate/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        assertion: {
          id: pk.id,
          rawId: arrayBufferToBase64Url(pk.rawId),
          response: {
            authenticatorData: arrayBufferToBase64Url(assertionResponse.authenticatorData),
            clientDataJSON: arrayBufferToBase64Url(assertionResponse.clientDataJSON),
            signature: arrayBufferToBase64Url(assertionResponse.signature),
            userHandle: assertionResponse.userHandle
              ? arrayBufferToBase64Url(assertionResponse.userHandle)
              : null,
          },
          type: pk.type,
        },
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      throw new Error(err.message || 'Failed to verify assertion');
    }

    const result = await verifyRes.json();
    return { success: true, user: result.user, customToken: result.customToken ?? undefined };
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return { success: false, error: messageFor(error, 'Failed to authenticate with biometrics') };
  }
}

// ---------------------------------------------------------------------------
// Credential management (requires Firebase session)
// ---------------------------------------------------------------------------

export async function getUserCredentials(idToken: string): Promise<{
  hasCredentials: boolean;
  credentials?: Array<{ id: string; deviceName: string | null; createdAt: string; lastUsed: string | null }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/webauthn/credentials/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to fetch credentials');
    }
    const data = await res.json();
    return { hasCredentials: data.credentials.length > 0, credentials: data.credentials };
  } catch (error) {
    console.error('Error fetching credentials:', error);
    return { hasCredentials: false, error: messageFor(error, 'Failed to fetch credentials') };
  }
}

export async function deleteCredential(credentialId: string, idToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/auth/webauthn/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete credential');
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting credential:', error);
    return { success: false, error: messageFor(error, 'Failed to delete credential') };
  }
}

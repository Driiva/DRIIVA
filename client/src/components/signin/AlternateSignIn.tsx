/**
 * The sign-in alternatives below the password form: Google, and the passkey
 * offered only to a driver this device has seen before. Extracted verbatim
 * from client/src/pages/signin.tsx.
 */
import BiometricAuth from "@/components/BiometricAuth";

interface BiometricUser {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName?: string;
  firstName?: string;
}

interface AlternateSignInProps {
  isLoading: boolean;
  connectionStatus: 'checking' | 'connected' | 'unavailable';
  isReturningUser: boolean;
  biometricEmail: string;
  handleGoogleSignIn: () => void;
  onBiometricSuccess: (userData: BiometricUser) => void;
}

export function AlternateSignIn({
  isLoading,
  connectionStatus,
  isReturningUser,
  biometricEmail,
  handleGoogleSignIn,
  onBiometricSuccess,
}: AlternateSignInProps) {
  return (
    <>
                {/* Divider */}
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-white/15" />
                  <span className="text-white/60 text-[13px] uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-white/15" />
                </div>

                {/* Google Sign-In */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || connectionStatus === 'unavailable'}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  }}
                  aria-label="Continue with Google"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {isReturningUser && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-white/15" />
                      <span className="text-white/60 text-[13px] uppercase tracking-wider">or</span>
                      <div className="flex-1 h-px bg-white/15" />
                    </div>
                    <BiometricAuth
                      email={biometricEmail}
                      onSuccess={onBiometricSuccess}
                    />
                  </>
                )}
    </>
  );
}

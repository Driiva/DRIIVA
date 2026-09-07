/**
 * BiometricAuth — Face ID / Touch ID authentication component.
 *
 * Changes from original:
 *   - Accepts `email` instead of `username` (matches backend lookup)
 *   - Uses checkHasPasskey() (public endpoint) instead of the protected
 *     credentials list endpoint — no 401 before login
 *   - After authenticateWithBiometrics() returns a customToken, calls
 *     signInWithCustomToken() to establish a real Firebase session
 *   - Graceful fallback amber banner for unsupported devices (unchanged)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  checkBiometricSupport,
  checkHasPasskey,
  authenticateWithBiometrics,
  registerBiometricCredential,
  type BiometricUser,
} from '@/lib/webauthn';
import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import { Smartphone, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ArcTracer } from '@/components/motion/Instrument';

interface BiometricAuthProps {
  /** Email of the user trying to sign in (used for server lookup). */
  email: string;
  onSuccess: (userData: BiometricUser) => void;
  onRegister?: () => void;
}

export default function BiometricAuth({ email, onSuccess, onRegister }: BiometricAuthProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [supportDetails, setSupportDetails] = useState<{
    supported: boolean;
    platformAuthenticator: boolean;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkSupport();
  }, []);

  // Use public /check endpoint — safe to call before login
  useEffect(() => {
    if (email) {
      checkHasPasskey(email).then(setHasCredentials).catch(() => setHasCredentials(false));
    }
  }, [email]);

  const checkSupport = async () => {
    const support = await checkBiometricSupport();
    setSupportDetails(support);
    setIsSupported(support.supported && support.platformAuthenticator);
  };

  const handleBiometricAuth = async () => {
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter your email first', variant: 'destructive' });
      return;
    }
    setIsAuthenticating(true);
    try {
      const result = await authenticateWithBiometrics(email);
      if (!result.success) throw new Error(result.error || 'Authentication failed');

      // Bridge to Firebase session via custom token
      if (result.customToken && auth) {
        await signInWithCustomToken(auth, result.customToken);
      }

      // The server only returns a user alongside success; typing that honestly
      // means saying what happens if it ever does not, rather than handing
      // undefined to a caller that will dereference it.
      if (!result.user) throw new Error('Authentication succeeded but returned no account');
      onSuccess(result.user);
      toast({ title: 'Welcome back!', description: `Authenticated with ${getDeviceLabel()}` });
    } catch (error) {
      console.error('Biometric authentication error:', error);
      toast({
        title: 'Authentication Failed',
        description: error instanceof Error && error.message ? error.message : 'Could not authenticate with biometrics',
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleBiometricRegistration = async () => {
    if (!email) {
      toast({ title: 'Email required', description: 'Please enter your email first', variant: 'destructive' });
      return;
    }
    setIsRegistering(true);
    try {
      const result = await registerBiometricCredential(email);
      if (!result.success) throw new Error(result.error || 'Registration failed');
      setHasCredentials(true);
      toast({ title: 'Passkey enabled!', description: `${getDeviceLabel()} has been enabled for your account` });
      if (onRegister) onRegister();
    } catch (error) {
      console.error('Biometric registration error:', error);
      toast({
        title: 'Setup Failed',
        description: error instanceof Error && error.message ? error.message : 'Could not set up biometric authentication',
        variant: 'destructive',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const getDeviceLabel = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/i.test(ua)) return 'Face ID';
    if (/Macintosh/i.test(ua)) return 'Touch ID';
    if (/Android/i.test(ua)) return 'Fingerprint';
    if (/Windows/i.test(ua)) return 'Windows Hello';
    return 'Biometric';
  };

  if (!isSupported || !supportDetails?.platformAuthenticator) {
    return (
      <div className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-sm text-amber-200">
            {supportDetails?.error || 'Biometric authentication not available on this device'}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {hasCredentials ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Button
            onClick={handleBiometricAuth}
            disabled={isAuthenticating || !email}
            className="w-full h-14 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 border-0 text-white font-medium transition-all duration-300"
            data-testid="button-biometric-auth"
          >
            <div className="flex items-center gap-3">
              {isAuthenticating ? (
                <ArcTracer size={24} label="Authenticating" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
              <span>{isAuthenticating ? 'Authenticating...' : `Sign in with ${getDeviceLabel()}`}</span>
            </div>
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <Button
            onClick={handleBiometricRegistration}
            disabled={isRegistering || !email}
            variant="outline"
            className="w-full h-14 bg-white/5 border-white/20 hover:bg-white/10 text-white font-medium transition-all duration-300"
            data-testid="button-biometric-register"
          >
            <div className="flex items-center gap-3">
              {isRegistering ? (
                <ArcTracer size={24} label="Authenticating" />
              ) : (
                <ShieldCheck className="w-6 h-6" />
              )}
              <span>{isRegistering ? 'Setting up...' : `Set up ${getDeviceLabel()}`}</span>
            </div>
          </Button>
          <p className="text-xs text-white/60 text-center">
            Enable biometric authentication for faster, more secure login
          </p>
        </motion.div>
      )}

      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <span className="text-xs text-white/60 font-medium">OR</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  );
}

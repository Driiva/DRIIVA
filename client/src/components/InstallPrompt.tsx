import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, X, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

export default function InstallPrompt() {
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    if (isInStandaloneMode()) return;
    if (sessionStorage.getItem('install-prompt-dismissed')) return;

    if (isIos()) {
      // Show iOS prompt after 3s
      const t = setTimeout(() => setShowIosPrompt(true), 3000);
      return () => clearTimeout(t);
    }

    // Android/Chrome — listen for browser install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowAndroidPrompt(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShowIosPrompt(false);
    setShowAndroidPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('install-prompt-dismissed', '1');
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {/* iOS instruction sheet */}
      {showIosPrompt && (
        <motion.div
          key="ios-prompt"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8"
        >
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: 'var(--app-surface-1)', border: '1px solid var(--app-border)' }}>
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1 rounded-full text-white/60 hover:text-white/80"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-4 p-5 pb-3">
              <img src="/apple-touch-icon.png" alt="Driiva" className="w-14 h-14 rounded-2xl shadow-lg flex-shrink-0" />
              <div>
                <p className="font-semibold text-white text-base leading-tight">Add Driiva to your Home Screen</p>
                <p className="text-white/60 text-sm mt-0.5">Works like a native app — no App Store needed</p>
              </div>
            </div>

            <div className="px-5 pb-5 pt-2 space-y-2.5">
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sky-400 text-xs font-bold">1</span>
                </div>
                <span>Tap the <Share size={14} className="inline mx-0.5 text-sky-400" /> Share button at the bottom of Safari</span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sky-400 text-xs font-bold">2</span>
                </div>
                <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> <Plus size={13} className="inline ml-0.5 text-sky-400" /></span>
              </div>
              <div className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-7 h-7 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sky-400 text-xs font-bold">3</span>
                </div>
                <span>Tap <strong className="text-white">"Add"</strong> — done, it's on your home screen</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Android/Chrome native install banner */}
      {showAndroidPrompt && (
        <motion.div
          key="android-prompt"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8"
        >
          <div className="relative rounded-2xl overflow-hidden flex items-center gap-4 p-4"
            style={{ background: 'var(--app-surface-1)', border: '1px solid var(--app-border)' }}>
            <img src="/apple-touch-icon.png" alt="Driiva" className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">Add Driiva to Home Screen</p>
              <p className="text-white/60 text-xs">Works offline · No App Store needed</p>
            </div>
            <button onClick={dismiss} className="text-white/55 p-1 mr-1">
              <X size={16} />
            </button>
            <button
              onClick={installAndroid}
              className="text-white text-sm font-semibold px-4 py-2 rounded-xl flex-shrink-0"
              style={{
                background: 'var(--app-primary)',
                boxShadow: '0 4px 16px rgba(var(--app-primary-rgb), 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              }}
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Sparkles, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Check if the app is already installed or running in standalone mode
  useEffect(() => {
    // 1. Check if running in standalone display mode (installed PWA)
    const checkIsStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      
      return isStandaloneMode;
    };

    if (checkIsStandalone()) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if user previously dismissed prompt in current session
    const dismissedSession = sessionStorage.getItem('pigmypro_pwa_prompt_dismissed');
    if (dismissedSession === 'true') {
      setIsDismissed(true);
    }

    // 3. Detect iOS Safari (which doesn't fire beforeinstallprompt)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 4. Listen for the native `beforeinstallprompt` event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      // Stash the event so it can be triggered on user action
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // 5. Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger the installation flow using the saved beforeinstallprompt event
  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    } else if (isIOS) {
      // Show non-intrusive step-by-step guidance for iOS
      setShowIOSInstructions((prev) => !prev);
    }
  }, [deferredPrompt, isIOS]);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pigmypro_pwa_prompt_dismissed', 'true');
  };

  // If already installed, dismissed, or neither installable nor iOS, do not render
  if (isInstalled || isDismissed) {
    return null;
  }

  // Only render if browser fired beforeinstallprompt OR user is on iOS Safari where prompt is manual
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        aria-label="Install PigmyPro application"
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-40 sm:max-w-md select-none"
      >
        <div className="bg-slate-900/95 dark:bg-card/95 text-slate-100 border border-border/80 dark:border-indigo-500/30 shadow-2xl backdrop-blur-md rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* App Icon & Details */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
                <Smartphone size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs font-black text-white tracking-tight leading-none">
                    Install PigmyPro
                  </h3>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                    <Sparkles size={8} /> Fast & Offline
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 dark:text-text-secondary truncate mt-1">
                  Add to home screen for 1-tap launch and full-screen view
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <Download size={13} strokeWidth={2.5} />
                <span>Install</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-8 h-8 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Dismiss installation banner"
                aria-label="Dismiss installation prompt"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* iOS Specific Quick Guide */}
          {showIOSInstructions && isIOS && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-white/10 text-[11px] text-slate-300 space-y-1.5 leading-relaxed"
            >
              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                <span>🍏 Install on iPhone / iPad:</span>
              </div>
              <div className="flex items-center gap-2 pl-2">
                <Share size={13} className="text-indigo-400 shrink-0" />
                <span>1. Tap the <strong>Share</strong> button in Safari toolbar</span>
              </div>
              <div className="flex items-center gap-2 pl-2">
                <PlusSquare size={13} className="text-indigo-400 shrink-0" />
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong></span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

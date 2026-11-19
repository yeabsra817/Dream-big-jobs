import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectIsIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function detectIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as any)?.standalone === true ||
    Boolean(window.matchMedia?.('(display-mode: standalone)')?.matches)
  );
}

export function detectIsAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export function detectIsDesktopDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !detectIsIosDevice() && !detectIsAndroidDevice();
}

declare global {
  interface Window {
    __hopelandDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== 'undefined' && window.__hopelandDeferredInstallPrompt) {
      return window.__hopelandDeferredInstallPrompt;
    }
    return null;
  });
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectIsStandalone());
  const [isIOS] = useState<boolean>(() => detectIsIosDevice());
  const [isAndroid] = useState<boolean>(() => detectIsAndroidDevice());
  const [isDesktop] = useState<boolean>(() => detectIsDesktopDevice());

  useEffect(() => {
    const checkStandalone = () => {
      setIsInstalled(detectIsStandalone());
    };
    checkStandalone();

    if (window.__hopelandDeferredInstallPrompt) {
      setDeferredPrompt(window.__hopelandDeferredInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvt = e as BeforeInstallPromptEvent;
      window.__hopelandDeferredInstallPrompt = promptEvt;
      setDeferredPrompt(promptEvt);
    };

    const handleEarlyPromptReady = () => {
      if (window.__hopelandDeferredInstallPrompt) {
        setDeferredPrompt(window.__hopelandDeferredInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.__hopelandDeferredInstallPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('hopeland-install-prompt-ready', handleEarlyPromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.addEventListener) {
      mq.addEventListener('change', checkStandalone);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('hopeland-install-prompt-ready', handleEarlyPromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (mq?.removeEventListener) {
        mq.removeEventListener('change', checkStandalone);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? window.__hopelandDeferredInstallPrompt : null);
    if (!promptEvent) return 'unavailable';
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      window.__hopelandDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      return outcome;
    } catch {
      window.__hopelandDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const hasPrompt = Boolean(
    deferredPrompt || (typeof window !== 'undefined' && window.__hopelandDeferredInstallPrompt)
  );

  return {
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    isInstallable: hasPrompt && !isInstalled,
    canShowIosInstallGuide: isIOS && !isInstalled,
    canInstallApp: !isInstalled && (hasPrompt || isIOS),
    install,
  };
}

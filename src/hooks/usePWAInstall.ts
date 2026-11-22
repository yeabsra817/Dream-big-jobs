import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type DesktopOsType = 'windows' | 'mac' | 'linux';

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

export function detectDesktopOs(): DesktopOsType {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = ((navigator as any).platform || '').toLowerCase();
  if (ua.includes('mac') || platform.includes('mac')) return 'mac';
  if (ua.includes('linux') && !ua.includes('android')) return 'linux';
  return 'windows';
}

export function detectIsInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Telegram|FBAN|FBAV|Instagram|Line\/|Twitter|WhatsApp|; wv\)/i.test(ua);
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
  const [desktopOs] = useState<DesktopOsType>(() => detectDesktopOs());
  const [isInAppBrowser] = useState<boolean>(() => detectIsInAppBrowser());

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
    let promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? window.__hopelandDeferredInstallPrompt : null);

    // Briefly wait up to 700ms in case beforeinstallprompt is still arriving right after page load
    if (!promptEvent && typeof window !== 'undefined' && !isIOS && !isInAppBrowser) {
      promptEvent = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        let done = false;
        const finish = (ev: BeforeInstallPromptEvent | null) => {
          if (done) return;
          done = true;
          window.removeEventListener('hopeland-install-prompt-ready', onReady);
          resolve(ev);
        };
        const onReady = () => finish(window.__hopelandDeferredInstallPrompt || null);
        window.addEventListener('hopeland-install-prompt-ready', onReady, { once: true });
        setTimeout(() => finish(window.__hopelandDeferredInstallPrompt || null), 700);
      });
    }

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
  }, [deferredPrompt, isIOS, isInAppBrowser]);

  const hasPrompt = Boolean(
    deferredPrompt || (typeof window !== 'undefined' && window.__hopelandDeferredInstallPrompt)
  );

  return {
    isInstalled,
    isIOS,
    isAndroid,
    isDesktop,
    desktopOs,
    isInAppBrowser,
    isInstallable: hasPrompt && !isInstalled,
    canShowIosInstallGuide: isIOS && !isInstalled,
    canInstallApp: !isInstalled,
    install,
  };
}

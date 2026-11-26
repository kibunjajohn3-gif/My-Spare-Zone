import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isPersistentStorage, setIsPersistentStorage] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
    setIsAndroid(/android/.test(ua));

    if (navigator.storage?.persisted) {
      navigator.storage
        .persisted()
        .then((persisted) => setIsPersistentStorage(persisted))
        .catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (navigator.storage?.persist) {
        void navigator.storage
          .persist()
          .then((granted) => setIsPersistentStorage(granted))
          .catch(() => undefined);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (navigator.storage?.persist) {
        void navigator.storage
          .persist()
          .then((granted) => setIsPersistentStorage(granted))
          .catch(() => undefined);
      }
      return true;
    }
    return false;
  };

  const saveToPhoneStorage = async () => {
    setSavingOffline(true);
    try {
      if (navigator.storage?.persist) {
        const granted = await navigator.storage.persist();
        setIsPersistentStorage(granted);
      }

      if ('caches' in window) {
        const apiCache = await window.caches.open('parts-api-cache');
        const partsRes = await fetch('/api/parts');
        if (partsRes.ok) {
          await apiCache.put('/api/parts', partsRes.clone());
          const data = (await partsRes.json()) as {
            parts?: Array<{ imageUrl?: string }>;
          };
          const imageUrls = Array.from(
            new Set(
              [
                '/src/assets/images/hero_spare_zone_1794558117479.jpg',
                '/pwa-192x192.png',
                '/pwa-512x512.png',
                '/apple-touch-icon.png',
                ...(data.parts?.map((p) => p.imageUrl).filter(Boolean) as string[]),
              ].filter((u): u is string => typeof u === 'string' && u.startsWith('/')),
            ),
          );
          const imgCache = await window.caches.open('parts-images-cache');
          await Promise.allSettled(
            imageUrls.map(async (url) => {
              const res = await fetch(url);
              if (res.ok) {
                await imgCache.put(url, res);
              }
            }),
          );
        }
      }

      setOfflineSaved(true);
      return true;
    } catch {
      return false;
    } finally {
      setSavingOffline(false);
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isPersistentStorage,
    savingOffline,
    offlineSaved,
    install,
    saveToPhoneStorage,
  };
}

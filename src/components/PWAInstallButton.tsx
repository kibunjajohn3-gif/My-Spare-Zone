import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  MoreVertical,
  X,
  Copy,
  Check,
  ExternalLink,
  HardDriveDownload,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SHOP_NAME } from '../constants/catalog';

interface PWAInstallButtonProps {
  variant?: 'default' | 'subtle';
}

export function PWAInstallButton({ variant = 'default' }: PWAInstallButtonProps) {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isPersistentStorage,
    savingOffline,
    offlineSaved,
    install,
    saveToPhoneStorage,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!showGuideModal || !appUrl) return;
    let active = true;
    QRCode.toDataURL(appUrl, {
      width: 176,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [showGuideModal, appUrl]);

  // Suppress install prompt when already running in standalone installed mode
  if (isInstalled) {
    return null;
  }

  const handleActionClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        await saveToPhoneStorage();
      }
      return;
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Fallback ignored if clipboard permissions are blocked
    }
  };

  const buttonLabel = isInstallable
    ? 'Install to Phone Storage'
    : isIOS
      ? 'Install on iPhone / iPad'
      : isAndroid
        ? 'Install to Android Storage'
        : 'Install to Phone (Android & iOS)';

  return (
    <>
      <button
        type="button"
        onClick={handleActionClick}
        className={
          variant === 'subtle'
            ? 'inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-orange-700 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0'
        }
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 text-orange-600" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-orange-600" />
        )}
        <span>{buttonLabel}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="pwa-guide-title" className="font-display text-lg font-bold text-slate-900">
                  Install {SHOP_NAME} to Phone Storage
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Save the app, launcher icon, and offline catalog directly on your phone
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-700">
              {/* Instant QR & Phone Link Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                {qrDataUrl && (
                  <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                    <img
                      src={qrDataUrl}
                      alt={`QR code to install ${SHOP_NAME} into phone storage`}
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                  <p className="font-display font-bold text-slate-900 text-sm">
                    Open on Your Phone
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Scan with your phone camera or copy the direct link to install {SHOP_NAME} into your phone&apos;s app storage.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Phone Link</span>
                        </>
                      )}
                    </button>
                    {appUrl && (
                      <a
                        href={appUrl}
                        target="_top"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Standalone</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Offline Assets to Device Storage */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-display font-bold text-slate-900 text-xs sm:text-sm">
                    Offline Device Storage Cache
                  </p>
                  <p className="text-xs text-slate-600">
                    {offlineSaved || isPersistentStorage
                      ? 'Spare parts catalog and images are stored on this device for offline access.'
                      : 'Pre-save spare parts catalog and photos to this phone’s storage now.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveToPhoneStorage()}
                  disabled={savingOffline}
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    offlineSaved
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-60'
                  }`}
                >
                  {offlineSaved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved to Storage</span>
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="w-3.5 h-3.5" />
                      <span>{savingOffline ? 'Saving...' : 'Save Offline'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Android Instructions */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <p className="font-display font-bold text-slate-900 text-sm">
                  Android Phones (Installs as App in Phone Storage)
                </p>
                <ol className="space-y-1.5 text-xs text-slate-600 list-decimal list-inside">
                  <li>
                    Open the link in <strong>Google Chrome</strong> on your Android phone.
                  </li>
                  <li>
                    Tap the{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 align-middle">
                      <MoreVertical className="w-3.5 h-3.5" />
                      Menu
                    </span>{' '}
                    icon and select <strong>Install app</strong>.
                  </li>
                  <li>
                    Confirm <strong>Install</strong> — Android installs {SHOP_NAME} into your phone&apos;s app storage and app drawer.
                  </li>
                </ol>
              </div>

              {/* Apple iOS / Safari Instructions */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <p className="font-display font-bold text-slate-900 text-sm">
                  Apple iPhone & iPad (Safari)
                </p>
                <ol className="space-y-1.5 text-xs text-slate-600 list-decimal list-inside">
                  <li>
                    Open the link in <strong>Safari</strong> on your iPhone or iPad.
                  </li>
                  <li>
                    Tap{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 align-middle">
                      <Share className="w-3.5 h-3.5" />
                      Share
                    </span>{' '}
                    and select{' '}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 align-middle">
                      <PlusSquare className="w-3.5 h-3.5" />
                      Add to Home Screen
                    </span>
                    .
                  </li>
                  <li>
                    Tap <strong>Add</strong> to store {SHOP_NAME} on your home screen with offline caching.
                  </li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

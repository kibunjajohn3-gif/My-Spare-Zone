import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SHOP_NAME } from '../constants/catalog';
import { PWAInstallButton } from './PWAInstallButton';

export function MobileInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isAndroid, install, saveToPhoneStorage } =
    usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  // Show automatically when browser install prompt is available or on mobile devices
  if (!isInstallable && !isIOS && !isAndroid) {
    return null;
  }

  return (
    <div className="bg-slate-900 text-white border-b border-slate-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/pwa-192x192.png"
            alt=""
            aria-hidden="true"
            className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/20"
          />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">
              Install {SHOP_NAME} to Phone Storage
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              Launch from your home screen with offline spare parts caching
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInstallable ? (
            <button
              type="button"
              onClick={async () => {
                const accepted = await install();
                if (accepted) {
                  await saveToPhoneStorage();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          ) : (
            <PWAInstallButton variant="default" />
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            aria-label="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

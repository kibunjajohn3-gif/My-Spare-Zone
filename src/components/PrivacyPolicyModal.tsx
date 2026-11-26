import { useEffect } from 'react';
import { X, ShieldCheck, ExternalLink, Phone, MapPin } from 'lucide-react';
import {
  CUSTOMER_CARE_NUMBER,
  CUSTOMER_CARE_WHATSAPP_URL,
  PHYSICAL_STORE_ADDRESS,
  SHOP_NAME,
} from '../constants/catalog';
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_SECTIONS,
} from '../constants/privacyPolicy';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-orange-400" />
            </div>
            <div className="min-w-0">
              <h2
                id="privacy-policy-modal-title"
                className="font-display text-lg font-bold text-slate-900 truncate"
              >
                {SHOP_NAME} — Privacy Policy
              </h2>
              <p className="text-xs text-slate-500">
                Effective Date: {PRIVACY_POLICY_EFFECTIVE_DATE} · Kenya Data Protection Act, 2019
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
            >
              <span>Public Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-200/70 transition-colors"
              aria-label="Close Privacy Policy"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700">
            {PRIVACY_POLICY_INTRO}
          </div>

          <div className="space-y-5">
            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <section key={section.id} className="space-y-2">
                <h3 className="font-display text-base font-bold text-slate-900">
                  {section.title}
                </h3>
                {section.summary && (
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">
                    {section.summary}
                  </p>
                )}
                <ul className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-slate-700">
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">Privacy &amp; Data Inquiries</p>
              <p className="inline-flex items-center gap-1.5 text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                <span>{PHYSICAL_STORE_ADDRESS}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href={`tel:${CUSTOMER_CARE_NUMBER}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-orange-600" />
                <span className="font-mono">{CUSTOMER_CARE_NUMBER}</span>
              </a>
              <a
                href={CUSTOMER_CARE_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
              >
                <span>WhatsApp Support</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline"
          >
            <span>Open Public URL</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="hidden sm:inline text-[11px] text-slate-500 font-mono">
            Public Play Store URL: /privacy-policy
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

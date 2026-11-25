import { useEffect, useRef, useState } from 'react';
import {
  X,
  Wrench,
  Building2,
  Check,
  Copy,
  Percent,
  Users,
  ShoppingBag,
  Phone,
  Mail,
  MapPin,
  Upload,
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import type { AuthUser, GaragePartnerProfile, GaragePartnerType } from '../types';
import {
  formatCurrency,
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  isJoinedPartnerProgram,
  PARTNER_BASE_DISCOUNT_PCT,
  PARTNER_BULK_BONUS_PCT,
  PARTNER_BULK_MIN_QTY,
  PARTNER_BULK_MIN_SUBTOTAL,
  PARTNER_MAX_DISCOUNT_PCT,
  PARTNER_PROOF_TYPES,
  PARTNER_REGULAR_3_DISCOUNT_PCT,
  PARTNER_REGULAR_6_DISCOUNT_PCT,
  PARTNER_REGULAR_MIN_ITEMS,
  PARTNER_TOP_TIER_MIN_ITEMS,
  REFERRAL_MECHANIC_CREDIT_PCT,
  SHOP_NAME,
  CUSTOMER_CARE_NUMBER,
} from '../constants/catalog';

interface PartnerProgramModalProps {
  isOpen: boolean;
  currentUser: AuthUser | null;
  onClose: () => void;
  onPartnerRegistered: (token: string, user: AuthUser, partner: GaragePartnerProfile) => void;
  onOpenPartnerPortal?: () => void;
}

export function PartnerProgramModal({
  isOpen,
  currentUser,
  onClose,
  onPartnerRegistered,
  onOpenPartnerPortal,
}: PartnerProgramModalProps) {
  const existingPartner = currentUser?.partnerProfile;
  const isResubmittingRejected = existingPartner?.status === 'rejected';
  const showApplicationForm = !existingPartner || isResubmittingRejected;

  const proofInputRef = useRef<HTMLInputElement | null>(null);
  const [partnerType, setPartnerType] = useState<GaragePartnerType>('mechanic');
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [proofType, setProofType] = useState<string>(PARTNER_PROOF_TYPES[0]);
  const [proofDataUrl, setProofDataUrl] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofMimeType, setProofMimeType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const isProFlagged = isJoinedPartnerProgram(existingPartner);

  useEffect(() => {
    if (isOpen && existingPartner?.status === 'rejected') {
      setPartnerType(existingPartner.partnerType);
      setBusinessName(existingPartner.businessName);
      setContactName(existingPartner.contactName);
      setPhone(existingPartner.phone);
      setEmail(existingPartner.email);
      setLocation(existingPartner.location);
      setSpecialty(existingPartner.specialty ?? '');
      if (existingPartner.proofType) {
        setProofType(existingPartner.proofType);
      }
      setProofDataUrl('');
      setProofFileName('');
      setProofMimeType('');
    } else if (isOpen && currentUser && !existingPartner) {
      setContactName((prev) => prev || currentUser.name);
      setPhone((prev) => prev || currentUser.phone);
      setEmail((prev) => prev || currentUser.email);
    }
    if (!isOpen) {
      setError(null);
      setCopiedCode(false);
    }
  }, [isOpen, currentUser, existingPartner]);

  if (!isOpen) return null;

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const allowedImage = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type);
    const allowedPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

    if (!allowedImage && !allowedPdf) {
      setError('Please upload a PNG, JPG, WEBP, GIF image or a PDF document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Verification proof file must be 10 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProofDataUrl(reader.result);
        setProofFileName(file.name);
        setProofMimeType(allowedPdf ? 'application/pdf' : file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearProofSelection = () => {
    setProofDataUrl('');
    setProofFileName('');
    setProofMimeType('');
    if (proofInputRef.current) {
      proofInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!proofDataUrl) {
      setError(
        'Please attach a workshop photo, NITA certificate, business permit, or mechanic ID PDF/photo for verification.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/partners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerType,
          businessName: businessName.trim(),
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          location: location.trim(),
          specialty: specialty.trim(),
          proofType,
          proofDataUrl,
          proofFileName,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: AuthUser;
        partner?: GaragePartnerProfile;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user || !data.partner) {
        setError(data.error || 'Could not submit partner verification application.');
        return;
      }
      clearProofSelection();
      onPartnerRegistered(data.token, data.user, data.partner);
    } catch {
      setError('Network error while submitting your Garage / Mechanic verification application.');
    } finally {
      setSubmitting(false);
    }
  };

  const existingLoyaltyItems = getPartnerLoyaltyItemsCount(existingPartner);
  const activeTierPct = existingPartner
    ? getPartnerTierDiscountPct(
        existingLoyaltyItems,
        existingPartner.discountTierPercent,
        isProFlagged,
      )
    : PARTNER_BASE_DISCOUNT_PCT;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="partner-modal-title"
                className="font-display text-base sm:text-lg font-bold text-slate-900"
              >
                {existingPartner
                  ? 'Garage & Mechanic Partner Account'
                  : 'Garage & Mechanic Partner Program'}
              </h2>
              <p className="text-xs text-slate-500">
                Verified trade discounts, bulk rewards &amp; {REFERRAL_MECHANIC_CREDIT_PCT}% mechanic referral credit
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-200/60 transition-colors"
            aria-label="Close partner modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Benefit Tier Overview */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <Percent className="w-4 h-4 text-orange-600 mx-auto" />
              <p className="text-xs font-bold text-slate-900 mt-1">
                {PARTNER_BASE_DISCOUNT_PCT}% – {PARTNER_REGULAR_6_DISCOUNT_PCT}% Off
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                Trade &amp; regular buyer tier
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <ShoppingBag className="w-4 h-4 text-slate-800 mx-auto" />
              <p className="text-xs font-bold text-slate-900 mt-1">
                +{PARTNER_BULK_BONUS_PCT}% Bulk Bonus
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                {PARTNER_BULK_MIN_QTY}+ items &amp; ≥ {formatCurrency(PARTNER_BULK_MIN_SUBTOTAL)}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <Users className="w-4 h-4 text-emerald-700 mx-auto" />
              <p className="text-xs font-bold text-slate-900 mt-1">
                {REFERRAL_MECHANIC_CREDIT_PCT}% Referral Credit
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                Credited after item fitting &amp; testing
              </p>
            </div>
          </div>

          {!showApplicationForm && existingPartner ? (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
                      {existingPartner.partnerType === 'garage'
                        ? 'Independent Garage Partner'
                        : 'Mobile Mechanic Partner'}
                    </p>
                    <h3 className="font-display text-lg font-bold mt-0.5">
                      {existingPartner.businessName}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {existingPartner.contactName} · {existingPartner.location}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                      existingPartner.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : existingPartner.status === 'pending'
                          ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {existingPartner.status === 'active'
                      ? 'Verified Active'
                      : existingPartner.status === 'pending'
                        ? 'Pending Approval'
                        : 'Paused'}
                  </span>
                </div>

                {existingPartner.status === 'active' && (
                  <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-700 text-xs">
                    <div>
                      <p className="text-slate-400 text-[11px]">Current Trade Tier</p>
                      <p className="font-mono font-bold text-base text-orange-400">
                        {activeTierPct}% off
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Up to {PARTNER_MAX_DISCOUNT_PCT}% on bulk
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Partner Items</p>
                      <p className="font-mono font-bold text-base text-white">
                        {existingLoyaltyItems}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isProFlagged
                          ? 'Loyalty tiers excluded'
                          : existingLoyaltyItems >= PARTNER_TOP_TIER_MIN_ITEMS
                            ? 'Top Tier Unlocked'
                            : existingLoyaltyItems >= PARTNER_REGULAR_MIN_ITEMS
                              ? `${PARTNER_TOP_TIER_MIN_ITEMS} items → ${PARTNER_REGULAR_6_DISCOUNT_PCT}%`
                              : `${PARTNER_REGULAR_MIN_ITEMS} items → ${PARTNER_REGULAR_3_DISCOUNT_PCT}%`}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Referral Credit</p>
                      <p className="font-mono font-bold text-base text-emerald-400">
                        {formatCurrency(existingPartner.referralCreditBalance || 0)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatCurrency(existingPartner.referralCreditPending || 0)} pending fit · {existingPartner.referralsCount} ref
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {existingPartner.status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-blue-950">
                        Application Submitted — Pending Admin Verification
                      </p>
                      <p className="text-xs text-blue-900 leading-relaxed">
                        Our team is reviewing your mechanic/garage proof before activating wholesale discounts and your referral code. You will receive an automated SMS at{' '}
                        <strong className="font-mono">{existingPartner.phone}</strong> as soon as your account is approved.
                      </p>
                    </div>
                  </div>

                  {existingPartner.proofUrl && (
                    <div className="flex items-center justify-between gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-700 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {existingPartner.proofType || 'Verification Document'}
                          </p>
                          {existingPartner.proofFileName && (
                            <p className="text-[11px] text-slate-500 truncate">
                              {existingPartner.proofFileName}
                            </p>
                          )}
                        </div>
                      </div>
                      <a
                        href={existingPartner.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                      >
                        <span>View Proof</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {existingPartner.status === 'paused' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
                  Your partner account is currently paused by shop administration. Wholesale trade pricing and referral discounts will resume once reactivated. Call{' '}
                  <a href={`tel:${CUSTOMER_CARE_NUMBER}`} className="font-mono font-bold underline">
                    {CUSTOMER_CARE_NUMBER}
                  </a>{' '}
                  for assistance.
                </div>
              )}

              {/* Referral Code Share Card (Active Partners Only) */}
              {existingPartner.status === 'active' && (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-emerald-950">
                      Your Mechanic / Garage Referral Code
                    </p>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      Share this code with vehicle owners you refer to {SHOP_NAME}. Customers pay standard pricing (no customer discount), and you earn a{' '}
                      <strong>{REFERRAL_MECHANIC_CREDIT_PCT}% credit</strong> on your active account after the part is fitted and tested.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-2 font-mono text-sm font-bold text-slate-900 tracking-wider">
                        {existingPartner.referralCode}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(existingPartner.referralCode)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    Your partner &amp; bulk discounts apply automatically at checkout whenever you are signed in.
                  </p>
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                {onOpenPartnerPortal && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPartnerPortal();
                    }}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                  >
                    Open Partner Portal
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isResubmittingRejected && existingPartner && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-1.5 text-xs text-red-900">
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Previous Application Needs Updated Proof</span>
                  </div>
                  {existingPartner.rejectionReason && (
                    <p className="leading-relaxed">{existingPartner.rejectionReason}</p>
                  )}
                  <p className="text-[11px] text-red-700">
                    Update your details or upload a clearer photo/PDF document below to resubmit for review.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Account Type
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPartnerType('mechanic')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      partnerType === 'mechanic'
                        ? 'bg-orange-50 border-orange-500 text-orange-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Mobile Mechanic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerType('garage')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                      partnerType === 'garage'
                        ? 'bg-orange-50 border-orange-500 text-orange-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Independent Garage</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {partnerType === 'garage' ? 'Garage / Workshop Name' : 'Mechanic Business / Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={
                      partnerType === 'garage' ? 'e.g. Apex Auto Garage' : 'e.g. Kamau Mobile Mechanics'
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lead Contact Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Peter Mwangi"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number (SMS Alert)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0712345678"
                      className="w-full pl-8 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="garage@example.com"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Garage / Operating Area
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Industrial Area, Ngong Rd"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specialty (Optional)
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g. CVT Gearboxes, Volvo, Toyota"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Mechanic / Garage Verification Proof Upload */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Mechanic / Garage Verification Proof (Required)</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Upload a photo or PDF so our admin can verify your workshop before activating wholesale trade discounts.
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="partner-proof-type"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Document / Photo Type
                  </label>
                  <select
                    id="partner-proof-type"
                    value={proofType}
                    onChange={(e) => setProofType(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {PARTNER_PROOF_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {proofDataUrl ? (
                  <div className="bg-white border border-slate-300 rounded-lg p-3 space-y-2.5">
                    {proofMimeType === 'application/pdf' ? (
                      <div className="flex items-center gap-2.5 text-xs text-slate-800">
                        <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{proofFileName || 'proof.pdf'}</p>
                          <p className="text-[11px] text-slate-500">PDF document attached</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="w-full h-36 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                          <img
                            src={proofDataUrl}
                            alt="Uploaded verification proof preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-[11px] text-slate-600 truncate">
                          Attached: <span className="font-medium">{proofFileName}</span>
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={clearProofSelection}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove &amp; Upload Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white hover:bg-slate-50 rounded-lg p-4 cursor-pointer transition-colors text-center">
                    <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-800">
                      Click to upload photo or PDF proof
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      PNG, JPG, WEBP, GIF or PDF · Max 10 MB
                    </span>
                    <input
                      ref={proofInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                      onChange={handleProofFileChange}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Joining the Partner Program automatically designates your account as a Professional Mechanic or Garage (excluding retail automated loyalty tiers in favor of partner trade pricing).
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Submitting Application...'
                    : isResubmittingRejected
                      ? 'Resubmit Application for Verification'
                      : 'Submit Partner Application for Verification'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

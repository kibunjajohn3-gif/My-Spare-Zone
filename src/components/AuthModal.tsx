import { useState } from 'react';
import { X, Phone, Mail, User, LogOut, ShieldCheck, ArrowRight, Wrench, Copy, Check, Heart } from 'lucide-react';
import type { AuthUser } from '../types';
import {
  getPartnerLoyaltyItemsCount,
  getPartnerTierDiscountPct,
  isAccountProfessionalPartner,
  SHOP_NAME,
} from '../constants/catalog';

interface AuthModalProps {
  isOpen: boolean;
  currentUser: AuthUser | null;
  sessionId?: string;
  wishlistCount?: number;
  authNotice?: string | null;
  onClose: () => void;
  onLoginSuccess: (token: string, user: AuthUser, adminVerified: boolean) => void;
  onLogout: () => Promise<void>;
  onOpenAdminPortal: () => void;
  onOpenOrderHistory: () => void;
  onOpenWishlist?: () => void;
  onOpenPartnerModal?: () => void;
  onOpenPartnerPortal?: () => void;
  onOpenPrivacyPolicy?: () => void;
}

export function AuthModal({
  isOpen,
  currentUser,
  sessionId,
  wishlistCount = 0,
  authNotice = null,
  onClose,
  onLoginSuccess,
  onLogout,
  onOpenAdminPortal,
  onOpenOrderHistory,
  onOpenWishlist,
  onOpenPartnerModal,
  onOpenPartnerPortal,
  onOpenPrivacyPolicy,
}: AuthModalProps) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);

  if (!isOpen) return null;

  const isProFlagged = isAccountProfessionalPartner(currentUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedName = name.trim();
    if (cleanedName.length < 2) {
      setError('Please enter your full name so it appears in Customer Care chats and receipts.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          email: email.trim(),
          name: cleanedName,
          ...(sessionId ? { sessionId } : {}),
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: AuthUser;
        adminVerified?: boolean;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        setError(data.error || 'Could not sign in. Please check your mobile number and email.');
        return;
      }

      onLoginSuccess(data.token, data.user, Boolean(data.adminVerified));
      setPhone('');
      setEmail('');
      setName('');
      onClose();
    } catch {
      setError('Network error while signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillCustomer = () => {
    setPhone('+254712345678');
    setEmail('customer@example.com');
    setName('Samuel Kamau');
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="auth-modal-title" className="font-display text-lg font-bold text-slate-900">
              {currentUser ? 'Account Profile' : `Sign in to ${SHOP_NAME}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser
                ? 'Signed in with your name, mobile number, and email'
                : 'Enter your names, mobile number, and email to continue'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Close account dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {currentUser ? (
          <div className="p-6 space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">Account Role</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <ShieldCheck
                    className={`w-3.5 h-3.5 ${
                      currentUser.role === 'admin' ? 'text-orange-600' : 'text-slate-500'
                    }`}
                  />
                  <span>
                    {currentUser.role === 'admin' ? 'Shop Administrator' : 'Customer Account'}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-xs text-slate-500">Name</span>
                <span className="font-semibold text-slate-900">{currentUser.name}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-xs text-slate-500">Mobile</span>
                <span className="font-mono text-xs text-slate-900">{currentUser.phone}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-xs text-slate-500">Email</span>
                <span className="text-xs text-slate-900">{currentUser.email}</span>
              </div>
            </div>

            {currentUser.partnerProfile && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-900">
                    <Wrench className="w-3.5 h-3.5 text-orange-600" />
                    <span>
                      {currentUser.partnerProfile.partnerType === 'garage'
                        ? 'Partner Garage'
                        : 'Partner Mechanic'}
                    </span>
                  </span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      currentUser.partnerProfile.status === 'active'
                        ? 'text-emerald-700'
                        : currentUser.partnerProfile.status === 'pending'
                          ? 'text-blue-700'
                          : currentUser.partnerProfile.status === 'rejected'
                            ? 'text-red-700'
                            : 'text-amber-700'
                    }`}
                  >
                    {currentUser.partnerProfile.status === 'active'
                      ? `${getPartnerTierDiscountPct(
                          getPartnerLoyaltyItemsCount(currentUser.partnerProfile),
                          currentUser.partnerProfile.discountTierPercent,
                          isProFlagged,
                        )}% Trade Tier`
                      : currentUser.partnerProfile.status === 'pending'
                        ? 'Pending Review'
                        : currentUser.partnerProfile.status === 'rejected'
                          ? 'Rejected'
                          : 'Paused'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {currentUser.partnerProfile.businessName}
                </p>
                {currentUser.partnerProfile.status === 'active' ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
                    <span>
                      Items:{' '}
                      <strong className="font-mono">
                        {getPartnerLoyaltyItemsCount(currentUser.partnerProfile)}
                      </strong>{' '}
                      · Orders: <strong className="font-mono">{currentUser.partnerProfile.ordersCount}</strong> · Referrals:{' '}
                      <strong className="font-mono">{currentUser.partnerProfile.referralsCount}</strong>
                      {((currentUser.partnerProfile.referralCreditBalance || 0) > 0 ||
                        (currentUser.partnerProfile.referralCreditPending || 0) > 0) && (
                        <>
                          {' '}
                          · Credit:{' '}
                          <strong className="font-mono text-emerald-700">
                            KSh {(currentUser.partnerProfile.referralCreditBalance || 0).toLocaleString('en-KE')}
                          </strong>
                          {(currentUser.partnerProfile.referralCreditPending || 0) > 0 && (
                            <span className="text-amber-700">
                              {' '}
                              (+KSh {(currentUser.partnerProfile.referralCreditPending || 0).toLocaleString('en-KE')} pending fit)
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(currentUser.partnerProfile!.referralCode);
                          setCopiedReferral(true);
                          window.setTimeout(() => setCopiedReferral(false), 1800);
                        } catch {
                          // ignore
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-bold bg-white border border-orange-300 rounded text-slate-900 hover:bg-orange-100 transition-colors"
                    >
                      <span>{currentUser.partnerProfile.referralCode}</span>
                      {copiedReferral ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {currentUser.partnerProfile.status === 'pending'
                      ? 'Your verification proof is being reviewed by admin. You will receive an SMS once approved.'
                      : currentUser.partnerProfile.status === 'rejected'
                        ? 'Verification rejected. Open the Partner Program modal to upload a clearer proof document.'
                        : 'Your partner account is currently paused.'}
                  </p>
                )}
                {isProFlagged && (
                  <p className="text-[11px] text-orange-900 pt-2 border-t border-orange-200/70">
                    Automatically flagged as a{' '}
                    <strong>
                      {currentUser.partnerProfile.partnerType === 'garage'
                        ? 'Garage Partner'
                        : 'Professional Mechanic Partner'}
                    </strong>{' '}
                    via the Partner Program (automated retail loyalty tiers excluded).
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {currentUser.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminPortal();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                >
                  <span>Open Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {currentUser.role !== 'admin' && currentUser.partnerProfile && onOpenPartnerPortal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPartnerPortal();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                >
                  <Wrench className="w-4 h-4" />
                  <span>Open Partner Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {currentUser.role !== 'admin' && onOpenPartnerModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPartnerModal();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-orange-950 bg-orange-100 hover:bg-orange-200 border border-orange-300 rounded-lg transition-colors"
                >
                  <Wrench className="w-4 h-4 text-orange-700" />
                  <span>
                    {currentUser.partnerProfile
                      ? 'Manage Partner Code & Tiers'
                      : 'Join Garage / Mechanic Partner Program'}
                  </span>
                </button>
              )}

              {currentUser.role !== 'admin' && onOpenWishlist && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWishlist();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  <Heart className="w-4 h-4 fill-rose-500 text-rose-600" />
                  <span>View Saved Wishlist ({wishlistCount})</span>
                </button>
              )}

              {currentUser.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenOrderHistory();
                  }}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  View Order History
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  await onLogout();
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {authNotice && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <Heart className="w-4 h-4 text-rose-600 fill-rose-500 shrink-0 mt-0.5" />
                <span>{authNotice}</span>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="auth-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +254712345678 or 0712345678"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. you@example.com"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="font-normal text-slate-500">(Shown on Customer Care chats)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Samuel Kamau"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="pt-3 border-t border-slate-200 space-y-2 text-xs text-slate-500">
              <p>
                Shoppers enter their full name, mobile number, and email so your exact name appears in Customer Care chats and receipts. Only the registered administrator credentials unlock the Admin Portal.
              </p>
              <p>
                By signing in, you agree to our{' '}
                {onOpenPrivacyPolicy ? (
                  <button
                    type="button"
                    onClick={onOpenPrivacyPolicy}
                    className="font-semibold text-orange-700 hover:text-orange-800 underline underline-offset-2"
                  >
                    Privacy Policy
                  </button>
                ) : (
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-orange-700 hover:text-orange-800 underline underline-offset-2"
                  >
                    Privacy Policy
                  </a>
                )}
                .
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillCustomer}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  Fill Sample Customer
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

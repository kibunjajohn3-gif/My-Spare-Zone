import { useEffect, useRef, useState } from 'react';
import { Lock, ShieldAlert, Eye, EyeOff, LogOut, ArrowRight } from 'lucide-react';
import type { AuthUser } from '../types';

interface AdminPasswordModalProps {
  isOpen: boolean;
  adminUser: AuthUser | null;
  authToken: string | null;
  initialAttemptsUsed?: number;
  onVerified: () => void;
  onForceLogout: (reason: string) => void;
  onCancelLogout: () => Promise<void>;
}

export function AdminPasswordModal({
  isOpen,
  adminUser,
  authToken,
  initialAttemptsUsed = 0,
  onVerified,
  onForceLogout,
  onCancelLogout,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(() =>
    Math.max(1, 2 - initialAttemptsUsed),
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError(null);
      setAttemptsRemaining(Math.max(1, 2 - initialAttemptsUsed));
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen, initialAttemptsUsed, authToken]);

  if (!isOpen || !adminUser || !authToken) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the administrator password.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/verify-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as {
        verified?: boolean;
        loggedOut?: boolean;
        attemptsRemaining?: number;
        error?: string;
      };

      if (res.ok && data.verified) {
        setPassword('');
        setError(null);
        onVerified();
        return;
      }

      if (data.loggedOut) {
        setPassword('');
        onForceLogout(
          data.error || 'Incorrect password entered twice. You have been logged out immediately.',
        );
        return;
      }

      if (typeof data.attemptsRemaining === 'number') {
        setAttemptsRemaining(data.attemptsRemaining);
      }
      setPassword('');
      setError(
        data.error || 'Incorrect admin password. 1 attempt remaining before immediate logout.',
      );
      window.setTimeout(() => inputRef.current?.focus(), 20);
    } catch {
      setError('Network error while verifying administrator password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-password-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="admin-password-title" className="font-display text-base font-bold truncate">
                Admin Security Verification
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                {adminUser.phone} · {adminUser.email}
              </p>
            </div>
          </div>
          <span className="px-2 py-1 text-[11px] font-mono tabular-nums font-semibold bg-white/10 text-orange-300 rounded-md shrink-0">
            {attemptsRemaining} {attemptsRemaining === 1 ? 'try' : 'tries'} left
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Enter your administrator password to continue to the Admin Console. For security,{' '}
            <strong className="text-slate-900">2 failed attempts</strong> will log you out
            immediately.
          </p>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="admin-security-password"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Administrator Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                id="admin-security-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <span>{submitting ? 'Verifying...' : 'Verify & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => void onCancelLogout()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Instead</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

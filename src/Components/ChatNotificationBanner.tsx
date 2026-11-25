import { Bell, MessageSquare, X, ArrowRight } from 'lucide-react';
import type { BrowserNotificationState } from '../utils/chatNotifications';

export interface ChatAlertNotification {
  id: string;
  sessionId: string;
  title: string;
  senderLabel: string;
  preview: string;
  createdAt: string;
}

interface ChatNotificationBannerProps {
  alert: ChatAlertNotification | null;
  unreadCount: number;
  notificationPermission: BrowserNotificationState;
  onOpenChat: (sessionId: string) => void;
  onDismiss: () => void;
  onEnableBrowserAlerts: () => void;
}

export function ChatNotificationBanner({
  alert,
  unreadCount,
  notificationPermission,
  onOpenChat,
  onDismiss,
  onEnableBrowserAlerts,
}: ChatNotificationBannerProps) {
  if (!alert) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[calc(100%-2.5rem)] max-w-sm bg-slate-900 text-white border border-slate-700 rounded-xl shadow-2xl p-4 no-print"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-orange-600 text-white flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-400 truncate">
                {alert.title}
              </p>
              {unreadCount > 1 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-bold bg-orange-600 text-white rounded-md shrink-0">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white truncate mt-0.5">
              {alert.senderLabel}
            </p>
            <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
              {alert.preview}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss chat alert"
          className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
        {notificationPermission === 'default' ? (
          <button
            type="button"
            onClick={onEnableBrowserAlerts}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-orange-400" />
            <span>Enable Desktop Alerts</span>
          </button>
        ) : (
          <span className="text-[11px] text-slate-400 tabular-nums">
            {new Date(alert.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpenChat(alert.sessionId)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors ml-auto"
        >
          <span>Open Chat</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

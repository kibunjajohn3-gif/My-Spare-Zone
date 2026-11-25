import { useEffect, useRef, useState } from 'react';
import { X, Phone, Send, Copy, Check, MessageCircle, Wrench, Truck, Bell } from 'lucide-react';
import type { AuthUser, ChatMessage } from '../types';
import {
  CUSTOMER_CARE_NUMBER,
  CUSTOMER_CARE_WHATSAPP_URL,
  DELIVERY_SERVICE_NOTICE,
  GARAGE_FITTING_SERVICE_NOTICE,
  MECHANIC_SERVICE_NOTICE,
  PHYSICAL_STORE_HOURS,
  SHOP_NAME,
} from '../constants/catalog';
import {
  getOrCreateChatSessionId,
  type BrowserNotificationState,
} from '../utils/chatNotifications';

interface CustomerCareDrawerProps {
  isOpen: boolean;
  sessionId?: string;
  currentUser: AuthUser | null;
  authToken?: string | null;
  latestChatMessage?: ChatMessage | null;
  notificationPermission?: BrowserNotificationState;
  onRequestNotificationPermission?: () => void;
  onClose: () => void;
}

export function CustomerCareDrawer({
  isOpen,
  sessionId: controlledSessionId,
  currentUser,
  authToken = null,
  latestChatMessage = null,
  notificationPermission = 'default',
  onRequestNotificationPermission,
  onClose,
}: CustomerCareDrawerProps) {
  const [fallbackSessionId] = useState<string>(() => getOrCreateChatSessionId());
  const sessionId = controlledSessionId || fallbackSessionId;
  const [customerName, setCustomerName] = useState<string>(
    () => currentUser?.name || window.localStorage.getItem('msz_chat_customer_name') || '',
  );

  useEffect(() => {
    if (currentUser?.name) {
      setCustomerName(currentUser.name);
      try {
        window.localStorage.setItem('msz_chat_customer_name', currentUser.name);
      } catch {
        // ignore storage restrictions
      }
    }
  }, [currentUser?.id, currentUser?.name]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: ChatMessage[] };
      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
    } catch {
      // ignore transient fetch error
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadMessages();
  }, [isOpen, sessionId]);

  useEffect(() => {
    if (!latestChatMessage || latestChatMessage.sessionId !== sessionId) return;
    setMessages((prev) =>
      prev.some((m) => m.id === latestChatMessage.id)
        ? prev
        : [...prev, latestChatMessage],
    );
  }, [latestChatMessage, sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isOpen]);

  if (!isOpen) return null;

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(CUSTOMER_CARE_NUMBER);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const effectiveName = currentUser?.name?.trim() || customerName.trim() || 'Shopper';
    window.localStorage.setItem('msz_chat_customer_name', effectiveName);

    setSending(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          customerName: effectiveName,
          sender: 'customer',
          text,
        }),
      });
      if (res.ok) {
        setDraft('');
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50 backdrop-blur-xs no-print">
      <div
        className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Customer Care Chat"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {SHOP_NAME} Customer Care
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct line & live support for fitment and orders
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onRequestNotificationPermission && notificationPermission === 'default' && (
              <button
                type="button"
                onClick={onRequestNotificationPermission}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-md transition-colors"
                title="Enable desktop notification alerts for new replies"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Enable Alerts</span>
              </button>
            )}
            {notificationPermission === 'granted' && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md"
                title="Desktop notification alerts enabled"
              >
                <Bell className="w-3 h-3" />
                <span>Alerts On</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close customer care chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Direct Phone Line & WhatsApp Strip */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Customer Care Hotline</p>
                <a
                  href={`tel:${CUSTOMER_CARE_NUMBER}`}
                  className="text-sm font-mono font-semibold text-slate-900 hover:text-orange-700"
                >
                  {CUSTOMER_CARE_NUMBER}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyPhone}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={`tel:${CUSTOMER_CARE_NUMBER}`}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Call
              </a>
              <a
                href={CUSTOMER_CARE_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
            <p className="flex items-start gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
              <span>
                {MECHANIC_SERVICE_NOTICE} {GARAGE_FITTING_SERVICE_NOTICE} ({PHYSICAL_STORE_HOURS})
              </span>
            </p>
            <p className="flex items-start gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-700 shrink-0 mt-0.5" />
              <span>{DELIVERY_SERVICE_NOTICE}</span>
            </p>
          </div>
        </div>

        {/* Name Bar */}
        <div className="px-6 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-white">
          <label htmlFor="chat-customer-name" className="text-xs text-slate-500 shrink-0">
            Your Name:
          </label>
          <input
            id="chat-customer-name"
            type="text"
            value={currentUser?.name || customerName}
            readOnly={Boolean(currentUser?.name)}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            className={`flex-1 text-xs px-2 py-1 border rounded focus:outline-none ${
              currentUser?.name
                ? 'bg-slate-50 text-slate-900 font-semibold border-slate-200 cursor-default'
                : 'text-slate-900 border-slate-200 focus:ring-1 focus:ring-orange-600'
            }`}
          />
          {currentUser?.name && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
              Account Name
            </span>
          )}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50/50">
          {messages.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-900">Start a conversation</p>
              <p>
                Ask about vehicle compatibility, stock availability, or 7-day guarantee support. Our team responds here and via{' '}
                <span className="font-mono font-medium text-slate-900">{CUSTOMER_CARE_NUMBER}</span>.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCustomer = msg.sender === 'customer';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isCustomer
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p>{msg.text}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 px-1">
                    {isCustomer ? msg.customerName || 'You' : 'Customer Care'} ·{' '}
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Message Composer */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message to customer care..."
            className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center justify-center p-2.5 text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-lg transition-colors"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

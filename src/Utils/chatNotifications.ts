export const CHAT_SESSION_STORAGE_KEY = 'msz_chat_session_id';

export function getOrCreateChatSessionId(): string {
  try {
    const existing = window.localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const created = `sess-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CHAT_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return `sess-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export type BrowserNotificationState = NotificationPermission | 'unsupported';

export function getNotificationPermissionState(): BrowserNotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
}

export async function requestChatNotificationPermission(): Promise<BrowserNotificationState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission !== 'default') {
    return window.Notification.permission;
  }
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function showBrowserChatNotification(options: {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}) {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    window.Notification.permission !== 'granted'
  ) {
    return;
  }
  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      tag: options.tag,
      icon: '/pwa-192x192.png',
    });
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  } catch {
    // ignore environments where Notification constructor is blocked
  }
}

export function playChatNotificationSound() {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.11, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(660, 0, 0.14);
    playTone(880, 0.12, 0.18);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 600);
  } catch {
    // ignore autoplay restriction errors before user gesture
  }
}

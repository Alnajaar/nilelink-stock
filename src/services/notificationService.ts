import { StockItem, PushNotificationSettings, PushNotificationLog } from '../types/stock';

const NOTIF_SETTINGS_KEY = 'barstock_v2_push_settings';
const NOTIF_LOGS_KEY = 'barstock_v2_push_logs';

export class NotificationService {
  private static swRegistration: ServiceWorkerRegistration | null = null;
  private static listeners: ((logs: PushNotificationLog[]) => void)[] = [];
  private static lastAlertedItems: Record<string, number> = {}; // Debounce alert timestamps

  public static async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        this.swRegistration = reg;
        console.log('[NotificationService] Service worker registered successfully:', reg.scope);
      } catch (err) {
        console.warn('[NotificationService] Service worker registration notice:', err);
      }
    }
  }

  public static getSettings(): PushNotificationSettings {
    const defaultSettings: PushNotificationSettings = {
      enabled: typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
      alertOnMinLevel: true,
      alertOnZeroStock: true,
      alertOnTheftFlag: true,
      browserPermission:
        typeof window !== 'undefined' && 'Notification' in window
          ? Notification.permission
          : 'unsupported',
      soundAlerts: true,
      quietHoursEnabled: false
    };

    if (typeof localStorage === 'undefined') return defaultSettings;
    const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) return defaultSettings;

    try {
      const parsed = JSON.parse(raw);
      return {
        ...defaultSettings,
        ...parsed,
        browserPermission:
          typeof window !== 'undefined' && 'Notification' in window
            ? Notification.permission
            : 'unsupported'
      };
    } catch {
      return defaultSettings;
    }
  }

  public static saveSettings(settings: PushNotificationSettings): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
    }
  }

  public static async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const perm = await Notification.requestPermission();
      const settings = this.getSettings();
      settings.browserPermission = perm;
      settings.enabled = perm === 'granted';
      this.saveSettings(settings);
      return perm;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  public static getLogs(): PushNotificationLog[] {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(NOTIF_LOGS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveLogs(logs: PushNotificationLog[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(NOTIF_LOGS_KEY, JSON.stringify(logs.slice(0, 50)));
      this.listeners.forEach(fn => fn(logs));
    }
  }

  public static subscribe(listener: (logs: PushNotificationLog[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getLogs());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public static markAllAsRead(): void {
    const logs = this.getLogs().map(l => ({ ...l, read: true }));
    this.saveLogs(logs);
  }

  /**
   * Scans inventory items and sends web push notifications if stock drops below critical thresholds.
   * Runs in foreground or when window is minimized.
   */
  public static async checkStockAndAlert(
    items: StockItem[],
    cafeName: string,
    forced = false
  ): Promise<number> {
    const settings = this.getSettings();
    if (!settings.enabled && !forced) return 0;

    let alertCount = 0;
    const now = Date.now();
    const cooldownMs = 15 * 60 * 1000; // Do not spam same item more than once every 15 mins

    for (const item of items) {
      const isDepleted = item.currentStock <= 0;
      const isCritical = item.currentStock <= item.minLevel;

      if (!isCritical && !isDepleted) continue;

      const lastAlert = this.lastAlertedItems[item.id] || 0;
      if (now - lastAlert < cooldownMs && !forced) continue;

      this.lastAlertedItems[item.id] = now;
      alertCount++;

      const title = isDepleted
        ? `🚨 OUT OF STOCK: ${item.name} (${cafeName})`
        : `⚠️ Critical Stock Alert: ${item.name} (${cafeName})`;

      const body = isDepleted
        ? `Stock hit 0 ${item.unit}! Emergency restock required immediately for bar service.`
        : `Only ${item.currentStock} ${item.unit} left (minimum threshold is ${item.minLevel} ${item.unit}).`;

      // Log notification
      const logEntry: PushNotificationLog = {
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        title,
        body,
        type: 'CRITICAL_STOCK',
        itemId: item.id,
        read: false
      };

      const currentLogs = this.getLogs();
      this.saveLogs([logEntry, ...currentLogs]);

      // Dispatch Web Push notification
      await this.dispatchPush(title, body, { itemId: item.id, cafeName });
    }

    return alertCount;
  }

  /**
   * Dispatches push alert via Service Worker or native Notification API
   */
  public static async dispatchPush(
    title: string,
    body: string,
    data?: any
  ): Promise<boolean> {
    try {
      // 1. Try Service Worker showNotification (preferred for background/PWA)
      if (this.swRegistration && 'showNotification' in this.swRegistration) {
        await (this.swRegistration as any).showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'barstock-critical-alert',
          requireInteraction: true,
          data: data || {}
        });
        return true;
      }

      // 2. Fallback to native window Notification if granted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'barstock-critical-alert'
        });
        return true;
      }
    } catch (err) {
      console.warn('Failed to dispatch push notification:', err);
    }
    return false;
  }

  /**
   * Send a test push notification to verify browser permissions and audio vibration
   */
  public static async sendTestNotification(cafeName: string): Promise<boolean> {
    const title = `🔔 Push Notification Verified · ${cafeName}`;
    const body = `Web Push Service is active! You will receive instant background alerts when essential stock drops below minimum thresholds.`;

    const logEntry: PushNotificationLog = {
      id: 'notif-test-' + Date.now(),
      timestamp: new Date().toISOString(),
      title,
      body,
      type: 'SYSTEM',
      read: false
    };

    const currentLogs = this.getLogs();
    this.saveLogs([logEntry, ...currentLogs]);

    return this.dispatchPush(title, body, { test: true });
  }
}

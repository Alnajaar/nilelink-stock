import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Check,
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  ShieldCheck,
  Send,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { NotificationService } from '../services/notificationService';
import { PushNotificationSettings, PushNotificationLog } from '../types/stock';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cafeName: string;
  onShowToast: (msg: string, type?: 'ok' | 'err') => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  cafeName,
  onShowToast
}) => {
  const [settings, setSettings] = useState<PushNotificationSettings>(NotificationService.getSettings());
  const [logs, setLogs] = useState<PushNotificationLog[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(NotificationService.getSettings());
      setLogs(NotificationService.getLogs());
      const unsub = NotificationService.subscribe(newLogs => {
        setLogs(newLogs);
      });
      return () => unsub();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const perm = await NotificationService.requestPermission();
    const updated = NotificationService.getSettings();
    setSettings(updated);
    if (perm === 'granted') {
      onShowToast('Web Push Notifications successfully authorized!', 'ok');
    } else if (perm === 'denied') {
      onShowToast('Browser push permission was blocked in settings.', 'err');
    }
  };

  const handleToggle = (key: keyof PushNotificationSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    NotificationService.saveSettings(updated);
  };

  const handleSendTestPush = async () => {
    setIsTesting(true);
    try {
      const ok = await NotificationService.sendTestNotification(cafeName);
      if (ok) {
        onShowToast('Test Push Notification dispatched to your device!', 'ok');
      } else {
        onShowToast('Permission needed to show native push notifications.', 'err');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Web Push Notification Service</h3>
              <p className="text-xs text-slate-400">Background alerts when stock drops below threshold</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Permission Status Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              settings.browserPermission === 'granted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : settings.browserPermission === 'denied'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {settings.browserPermission === 'granted' ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm">
                  {settings.browserPermission === 'granted'
                    ? 'Push Notifications Active'
                    : settings.browserPermission === 'denied'
                    ? 'Push Blocked in Browser'
                    : 'Push Permission Required'}
                </p>
                <p className="text-[11px] opacity-85 mt-0.5">
                  {settings.browserPermission === 'granted'
                    ? 'You will receive background alerts even when the tab is closed or minimized.'
                    : settings.browserPermission === 'denied'
                    ? 'Please unblock notifications in your browser address bar settings.'
                    : 'Authorize notifications to receive instant emergency stock depletion warnings.'}
                </p>
              </div>
            </div>

            {settings.browserPermission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="h-8 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs whitespace-nowrap shadow-xs transition-colors shrink-0"
              >
                Enable Push
              </button>
            )}
          </div>

          {/* Trigger Toggles */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[10px]">
              Notification Trigger Rules
            </h4>

            <label className="flex items-center justify-between cursor-pointer py-1">
              <div>
                <span className="font-semibold text-slate-900 block">Critical Minimum Level Alert</span>
                <span className="text-[11px] text-slate-500">Alert when stock drops to or below safe minimum</span>
              </div>
              <input
                type="checkbox"
                checked={settings.alertOnMinLevel}
                onChange={() => handleToggle('alertOnMinLevel')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200/60 pt-2">
              <div>
                <span className="font-semibold text-slate-900 block">Zero Stock Emergency Warning</span>
                <span className="text-[11px] text-slate-500">Emergency push when an essential product hits 0</span>
              </div>
              <input
                type="checkbox"
                checked={settings.alertOnZeroStock}
                onChange={() => handleToggle('alertOnZeroStock')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200/60 pt-2">
              <div>
                <span className="font-semibold text-slate-900 block">Theft &amp; Variance Spike Warning</span>
                <span className="text-[11px] text-slate-500">Alert managers when audit flags suspected theft</span>
              </div>
              <input
                type="checkbox"
                checked={settings.alertOnTheftFlag}
                onChange={() => handleToggle('alertOnTheftFlag')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-slate-200/60 pt-2">
              <div>
                <span className="font-semibold text-slate-900 block">Vibrate &amp; Sound Chime</span>
                <span className="text-[11px] text-slate-500">Play tone on mobile phones &amp; POS terminals</span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundAlerts}
                onChange={() => handleToggle('soundAlerts')}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>

          {/* Test Push Dispatch */}
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5">
            <div>
              <p className="font-semibold text-amber-950">Test Service Worker Push Dispatch</p>
              <p className="text-[11px] text-amber-800/80">Sends a real push notification to verify delivery</p>
            </div>
            <button
              onClick={handleSendTestPush}
              disabled={isTesting}
              className="h-8 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>{isTesting ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
          </div>

          {/* Recent Push Logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[10px]">
                Recent Alert History ({logs.length})
              </h4>
              {logs.length > 0 && (
                <button
                  onClick={() => NotificationService.markAllAsRead()}
                  className="text-[11px] text-amber-600 hover:underline font-semibold"
                >
                  Mark all read
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                No recent stock alerts logged.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {logs.slice(0, 10).map(log => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                      log.type === 'CRITICAL_STOCK'
                        ? 'bg-red-50/60 border-red-200/60 text-red-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-[11px]">{log.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{log.body}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

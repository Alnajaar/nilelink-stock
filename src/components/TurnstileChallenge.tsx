import React, { useEffect, useRef, useState } from 'react';
import { ApiService } from '../services/apiService';

interface TurnstileWidgetApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWidgetApi;
  }
}

interface TurnstileChallengeProps {
  token: string;
  onTokenChange: (token: string) => void;
}

export const TurnstileChallenge: React.FC<TurnstileChallengeProps> = ({ token, onTokenChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onTokenChange);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    let active = true;
    ApiService.getTurnstileSiteKey().then(key => {
      if (!active) return;
      if (!key) {
        setError('Account verification is not configured.');
        return;
      }
      setSiteKey(key);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load verification.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let widgetId: string | null = null;
    let active = true;
    let script = document.querySelector<HTMLScriptElement>('script[data-nilelink-turnstile]');
    const render = () => {
      if (!active || !containerRef.current || !window.turnstile || widgetId) return;
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'register',
        callback: value => {
          callbackRef.current(value);
          setError('');
        },
        'error-callback': () => {
          callbackRef.current('');
          setError('Verification failed. Please try again.');
        },
        'expired-callback': () => callbackRef.current('')
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.nilelinkTurnstile = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    render();

    return () => {
      active = false;
      script?.removeEventListener('load', render);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} aria-label="Account verification challenge" />
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      {token && <p className="text-xs text-emerald-300">Verification complete.</p>}
    </div>
  );
};

import { TURNSTILE_SITE_KEY } from './turnstileConfig';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_ACTION = 'analysis_counter';
const TURNSTILE_CONTAINER_ID = 'usage-turnstile';

type TurnstileApi = {
  render: (container: HTMLElement | string, options: {
    sitekey: string;
    action: string;
    appearance: 'interaction-only';
    execution: 'execute';
    theme: 'auto';
    'response-field': false;
    callback: (token: string) => void;
    'error-callback': () => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
  }) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let hasExecuted = false;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

function clearPending() {
  pendingResolve = null;
  pendingReject = null;
}

function rejectPending(message: string) {
  pendingReject?.(new Error(message));
  clearPending();
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ai-detector-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile load failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.dataset.aiDetectorTurnstile = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile load failed'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function ensureWidget() {
  if (widgetId) return widgetId;
  const api = window.turnstile;
  const container = document.getElementById(TURNSTILE_CONTAINER_ID);
  if (!api || !container) throw new Error('Turnstile is not ready');

  widgetId = api.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    action: TURNSTILE_ACTION,
    appearance: 'interaction-only',
    execution: 'execute',
    theme: 'auto',
    'response-field': false,
    callback: (token) => {
      pendingResolve?.(token);
      clearPending();
      hasExecuted = true;
    },
    'error-callback': () => rejectPending('Turnstile verification failed'),
    'expired-callback': () => rejectPending('Turnstile token expired'),
    'timeout-callback': () => rejectPending('Turnstile verification timed out'),
  });

  return widgetId;
}

export async function prepareTurnstile() {
  try {
    await loadTurnstile();
    ensureWidget();
  } catch {
    // Usage analytics must never interrupt image analysis.
  }
}

export async function getTurnstileToken() {
  await loadTurnstile();
  const api = window.turnstile;
  if (!api) throw new Error('Turnstile is unavailable');
  const id = ensureWidget();

  if (hasExecuted) {
    api.reset(id);
    hasExecuted = false;
  }

  return await new Promise<string>((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    api.execute(id);
  });
}

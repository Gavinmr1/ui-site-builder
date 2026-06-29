export type AnalyticsEventName =
  | 'session_started'
  | 'project_bootstrapped'
  | 'project_saved'
  | 'project_loaded'
  | 'project_imported'
  | 'project_downloaded'
  | 'project_reset'
  | 'project_export_started'
  | 'project_export_completed'
  | 'project_export_failed'
  | 'code_copied'
  | 'preview_opened'
  | 'shortcuts_opened'
  | 'node_added'
  | 'node_updated'
  | 'node_removed'
  | 'node_moved'
  | 'node_duplicated'
  | 'theme_changed'
  | 'builder_error';

interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  timestamp: string;
  sessionId: string;
  path: string;
  payload?: Record<string, unknown>;
}

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void;
    posthog?: {
      capture?: (eventName: string, payload?: Record<string, unknown>) => void;
    };
  }
}

const STORAGE_KEY = 'site-builder.analytics.events.v1';
const MAX_STORED_EVENTS = 200;

let sessionId = '';
let initialized = false;

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  if (!sessionId) {
    sessionId = createId();
  }
  return sessionId;
}

function readQueue(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as AnalyticsEvent[] : [];
  } catch {
    return [];
  }
}

function persistEvent(event: AnalyticsEvent): void {
  try {
    const next = [...readQueue(), event].slice(-MAX_STORED_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore analytics persistence failures.
  }
}

function sendToEndpoint(event: AnalyticsEvent): void {
  const endpoint = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ANALYTICS_ENDPOINT;
  if (!endpoint) return;

  try {
    const body = JSON.stringify(event);
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      mode: 'no-cors',
    });
  } catch {
    // Ignore outbound analytics failures.
  }
}

function sendToProviders(name: AnalyticsEventName, payload?: Record<string, unknown>): void {
  try {
    window.plausible?.(name, { props: payload });
  } catch {
    // Ignore provider failures.
  }

  try {
    window.posthog?.capture?.(name, payload);
  } catch {
    // Ignore provider failures.
  }
}

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  trackEvent('session_started');
}

export function trackEvent(name: AnalyticsEventName, payload?: Record<string, unknown>): void {
  const event: AnalyticsEvent = {
    id: createId(),
    name,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
    payload,
  };

  persistEvent(event);
  sendToEndpoint(event);
  sendToProviders(name, payload);

  const debugFlag = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ANALYTICS_DEBUG;
  if (debugFlag === 'true') {
    console.info('[analytics]', name, payload ?? {});
  }
}

/**
 * Design Tokens – user-defined named color/spacing/font values.
 * Stored in localStorage under 'design-tokens'.
 */

export interface DesignToken {
  id: string;
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'font';
}

const STORAGE_KEY = 'design-tokens';

export const defaultTokens: DesignToken[] = [
  { id: 'primary', name: 'Primary', value: '#6366f1', category: 'color' },
  { id: 'secondary', name: 'Secondary', value: '#8b5cf6', category: 'color' },
  { id: 'accent', name: 'Accent', value: '#00d4ff', category: 'color' },
  { id: 'bg', name: 'Background', value: '#0f172a', category: 'color' },
  { id: 'surface', name: 'Surface', value: '#1e293b', category: 'color' },
  { id: 'text', name: 'Text', value: '#f1f5f9', category: 'color' },
  { id: 'muted', name: 'Muted', value: '#64748b', category: 'color' },
  { id: 'danger', name: 'Danger', value: '#ef4444', category: 'color' },
];

export function loadTokens(): DesignToken[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DesignToken[];
  } catch { /* ignore */ }
  return defaultTokens;
}

export function saveTokens(tokens: DesignToken[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

import type { ThemeConfig } from '../types';

const TOKEN_PREFIX = '--sb-';

export const themeVar = {
  primary: `var(${TOKEN_PREFIX}color-primary)`,
  secondary: `var(${TOKEN_PREFIX}color-secondary)`,
  background: `var(${TOKEN_PREFIX}color-background)`,
  surface: `var(${TOKEN_PREFIX}color-surface)`,
  text: `var(${TOKEN_PREFIX}color-text)`,
  textMuted: `var(${TOKEN_PREFIX}color-text-muted)`,
  border: `var(${TOKEN_PREFIX}color-border)`,
  onPrimary: `var(${TOKEN_PREFIX}color-on-primary)`,
  brandGradient: `var(${TOKEN_PREFIX}gradient-brand)`,
} as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim();
  if (![3, 6].includes(normalized.length)) return null;
  const expanded = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;
  const value = Number.parseInt(expanded, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastTextForPrimary(primary: string): string {
  const rgb = hexToRgb(primary);
  if (!rgb) return '#ffffff';
  return relativeLuminance(rgb) > 0.45 ? '#0f172a' : '#ffffff';
}

export function getThemeCssVars(theme: ThemeConfig): Record<string, string> {
  const onPrimary = contrastTextForPrimary(theme.colors.primary);
  return {
    [`${TOKEN_PREFIX}color-primary`]: theme.colors.primary,
    [`${TOKEN_PREFIX}color-secondary`]: theme.colors.secondary,
    [`${TOKEN_PREFIX}color-background`]: theme.colors.background,
    [`${TOKEN_PREFIX}color-surface`]: theme.colors.surface,
    [`${TOKEN_PREFIX}color-text`]: theme.colors.text,
    [`${TOKEN_PREFIX}color-text-muted`]: theme.colors.textMuted,
    [`${TOKEN_PREFIX}color-border`]: theme.colors.border,
    [`${TOKEN_PREFIX}color-on-primary`]: onPrimary,
    [`${TOKEN_PREFIX}gradient-brand`]: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
  };
}

export function getThemeCssVarsCss(theme: ThemeConfig): string {
  const vars = getThemeCssVars(theme);
  return Object.entries(vars).map(([key, value]) => `${key}: ${value};`).join('\n  ');
}

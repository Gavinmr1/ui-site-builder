import type { Breakpoint } from '../types';

const BREAKPOINT_KEYS = new Set(['desktop', 'tablet', 'mobile']);

export function resolveResponsiveStyles(
  styles: Record<string, unknown>,
  breakpoint: Breakpoint
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(styles ?? {})) {
    if (!BREAKPOINT_KEYS.has(key)) {
      base[key] = value;
    }
  }

  const desktopOverrides = (styles?.desktop as Record<string, unknown>) ?? {};
  const breakpointOverrides = (styles?.[breakpoint] as Record<string, unknown>) ?? {};

  if (breakpoint === 'desktop') {
    return { ...base, ...desktopOverrides };
  }

  // Non-desktop views inherit desktop overrides unless a specific breakpoint override exists.
  return { ...base, ...desktopOverrides, ...breakpointOverrides };
}

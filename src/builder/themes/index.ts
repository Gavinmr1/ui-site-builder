import type { ThemeConfig } from '../types';

const CUSTOM_THEMES_STORAGE_KEY = 'sitebuilder-custom-themes';

export type ThemeMode = 'light' | 'dark';

export interface ThemeFamily {
  id: string;
  label: string;
  light: ThemeConfig;
  dark: ThemeConfig;
}

const defaultSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '48px',
  '2xl': '80px',
};

const defaultRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '20px',
  full: '9999px',
};

function makeThemeConfig(args: {
  familyId: string;
  familyLabel: string;
  mode: ThemeMode;
  fontFamily: string;
  colors: ThemeConfig['colors'];
}): ThemeConfig {
  return {
    name: `${args.familyLabel} (${args.mode === 'dark' ? 'Dark' : 'Light'})`,
    familyId: args.familyId,
    mode: args.mode,
    colors: args.colors,
    typography: {
      fontFamily: args.fontFamily,
      baseFontSize: '16px',
    },
    spacing: defaultSpacing,
    borderRadius: defaultRadius,
  };
}

export const builtInThemeFamilies: ThemeFamily[] = [
  {
    id: 'indigo-core',
    label: 'Indigo Core',
    dark: makeThemeConfig({
      familyId: 'indigo-core',
      familyLabel: 'Indigo Core',
      mode: 'dark',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      colors: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        background: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        textMuted: '#94a3b8',
        border: '#334155',
      },
    }),
    light: makeThemeConfig({
      familyId: 'indigo-core',
      familyLabel: 'Indigo Core',
      mode: 'light',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      colors: {
        primary: '#4f46e5',
        secondary: '#7c3aed',
        background: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        textMuted: '#64748b',
        border: '#e2e8f0',
      },
    }),
  },
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    dark: makeThemeConfig({
      familyId: 'ocean-blue',
      familyLabel: 'Ocean Blue',
      mode: 'dark',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      colors: {
        primary: '#06b6d4',
        secondary: '#0ea5e9',
        background: '#020f1e',
        surface: '#041f3a',
        text: '#f0f9ff',
        textMuted: '#7dd3fc',
        border: '#0c4a6e',
      },
    }),
    light: makeThemeConfig({
      familyId: 'ocean-blue',
      familyLabel: 'Ocean Blue',
      mode: 'light',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      colors: {
        primary: '#0284c7',
        secondary: '#0891b2',
        background: '#f0f9ff',
        surface: '#ffffff',
        text: '#082f49',
        textMuted: '#0369a1',
        border: '#bae6fd',
      },
    }),
  },
  {
    id: 'warm-amber',
    label: 'Warm Amber',
    dark: makeThemeConfig({
      familyId: 'warm-amber',
      familyLabel: 'Warm Amber',
      mode: 'dark',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      colors: {
        primary: '#f59e0b',
        secondary: '#f97316',
        background: '#1c1007',
        surface: '#2d1f0a',
        text: '#fef3c7',
        textMuted: '#d97706',
        border: '#78350f',
      },
    }),
    light: makeThemeConfig({
      familyId: 'warm-amber',
      familyLabel: 'Warm Amber',
      mode: 'light',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      colors: {
        primary: '#d97706',
        secondary: '#ea580c',
        background: '#fff7ed',
        surface: '#fffbeb',
        text: '#431407',
        textMuted: '#9a3412',
        border: '#fed7aa',
      },
    }),
  },
  {
    id: 'neon-cyber',
    label: 'Neon Cyber',
    dark: makeThemeConfig({
      familyId: 'neon-cyber',
      familyLabel: 'Neon Cyber',
      mode: 'dark',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      colors: {
        primary: '#a855f7',
        secondary: '#ec4899',
        background: '#07001a',
        surface: '#120029',
        text: '#f5f0ff',
        textMuted: '#c084fc',
        border: '#4c1d95',
      },
    }),
    light: makeThemeConfig({
      familyId: 'neon-cyber',
      familyLabel: 'Neon Cyber',
      mode: 'light',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      colors: {
        primary: '#9333ea',
        secondary: '#db2777',
        background: '#faf5ff',
        surface: '#ffffff',
        text: '#3b0764',
        textMuted: '#7e22ce',
        border: '#e9d5ff',
      },
    }),
  },
  {
    id: 'aurora',
    label: 'Aurora',
    dark: makeThemeConfig({
      familyId: 'aurora',
      familyLabel: 'Aurora',
      mode: 'dark',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      colors: {
        primary: '#22d3ee',
        secondary: '#8b5cf6',
        background: '#04121a',
        surface: '#0b2230',
        text: '#e0f2fe',
        textMuted: '#7dd3fc',
        border: '#1e3a52',
      },
    }),
    light: makeThemeConfig({
      familyId: 'aurora',
      familyLabel: 'Aurora',
      mode: 'light',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      colors: {
        primary: '#0891b2',
        secondary: '#7c3aed',
        background: '#ecfeff',
        surface: '#f8fafc',
        text: '#0f172a',
        textMuted: '#155e75',
        border: '#bae6fd',
      },
    }),
  },
  {
    id: 'ember-dusk',
    label: 'Ember Dusk',
    dark: makeThemeConfig({
      familyId: 'ember-dusk',
      familyLabel: 'Ember Dusk',
      mode: 'dark',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      colors: {
        primary: '#fb7185',
        secondary: '#f59e0b',
        background: '#1a0e0b',
        surface: '#2a1712',
        text: '#fee2e2',
        textMuted: '#fda4af',
        border: '#7f1d1d',
      },
    }),
    light: makeThemeConfig({
      familyId: 'ember-dusk',
      familyLabel: 'Ember Dusk',
      mode: 'light',
      fontFamily: "'DM Sans', 'Inter', sans-serif",
      colors: {
        primary: '#e11d48',
        secondary: '#d97706',
        background: '#fff1f2',
        surface: '#fffbeb',
        text: '#4c0519',
        textMuted: '#9f1239',
        border: '#fecdd3',
      },
    }),
  },
  {
    id: 'mint-mono',
    label: 'Mint Mono',
    dark: makeThemeConfig({
      familyId: 'mint-mono',
      familyLabel: 'Mint Mono',
      mode: 'dark',
      fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
      colors: {
        primary: '#10b981',
        secondary: '#0ea5e9',
        background: '#061711',
        surface: '#0d251c',
        text: '#ecfdf5',
        textMuted: '#6ee7b7',
        border: '#14532d',
      },
    }),
    light: makeThemeConfig({
      familyId: 'mint-mono',
      familyLabel: 'Mint Mono',
      mode: 'light',
      fontFamily: "'IBM Plex Sans', 'Inter', sans-serif",
      colors: {
        primary: '#059669',
        secondary: '#0284c7',
        background: '#f0fdf4',
        surface: '#ffffff',
        text: '#052e16',
        textMuted: '#047857',
        border: '#bbf7d0',
      },
    }),
  },
];

export const defaultTheme: ThemeConfig = builtInThemeFamilies[0].dark;

export function getThemeFamilies(): ThemeFamily[] {
  return builtInThemeFamilies;
}

export function getDefaultThemeFamilyId(): string {
  return builtInThemeFamilies[0].id;
}

export function resolveThemeMode(theme: ThemeConfig): ThemeMode {
  return theme.mode === 'light' ? 'light' : 'dark';
}

export function resolveThemeFamilyId(theme: ThemeConfig): string {
  if (theme.familyId && builtInThemeFamilies.some((family) => family.id === theme.familyId)) {
    return theme.familyId;
  }

  const match = builtInThemeFamilies.find((family) => {
    const options = [family.light, family.dark];
    return options.some((option) => (
      option.colors.primary === theme.colors.primary
      && option.colors.secondary === theme.colors.secondary
      && option.colors.background === theme.colors.background
      && option.colors.surface === theme.colors.surface
      && option.colors.text === theme.colors.text
      && option.colors.textMuted === theme.colors.textMuted
      && option.colors.border === theme.colors.border
    ));
  });

  return match?.id ?? getDefaultThemeFamilyId();
}

export function getThemeForFamilyMode(familyId: string, mode: ThemeMode): ThemeConfig {
  const family = builtInThemeFamilies.find((item) => item.id === familyId) ?? builtInThemeFamilies[0];
  const variant = mode === 'light' ? family.light : family.dark;
  return structuredClone(variant);
}

export const themes: ThemeConfig[] = builtInThemeFamilies.flatMap((family) => [family.dark, family.light]);

export function loadCustomThemes(): ThemeConfig[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ThemeConfig => {
      return !!item && typeof item === 'object' && typeof (item as ThemeConfig).name === 'string';
    });
  } catch {
    return [];
  }
}

export function saveCustomTheme(theme: ThemeConfig): void {
  const nextName = theme.name.trim();
  if (!nextName) return;

  const current = loadCustomThemes();
  const withoutSame = current.filter((item) => item.name !== nextName);
  const next = [{ ...theme, name: nextName }, ...withoutSame].slice(0, 30);
  localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(next));
}

export function removeCustomTheme(themeName: string): void {
  const next = loadCustomThemes().filter((item) => item.name !== themeName);
  localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(next));
}

export function isBuiltInTheme(themeName: string): boolean {
  return themes.some((item) => item.name === themeName);
}

export function getAvailableThemes(): ThemeConfig[] {
  return [...themes, ...loadCustomThemes()];
}

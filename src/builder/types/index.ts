// ─── Core Node Types ──────────────────────────────────────────────────────────

export type BreakpointStyles = {
  desktop?: Record<string, unknown>;
  tablet?: Record<string, unknown>;
  mobile?: Record<string, unknown>;
};

export interface EditorNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  styles: Record<string, unknown> & BreakpointStyles;
  children: EditorNode[];
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  name: string;
  familyId?: string;
  mode?: 'light' | 'dark';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    baseFontSize: string;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface ProjectFile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  theme: ThemeConfig;
  pages: EditorNode[];
}

// ─── Responsive ───────────────────────────────────────────────────────────────

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

// ─── Component Registry ───────────────────────────────────────────────────────

export interface ComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string;
  defaultProps: Record<string, unknown>;
  defaultStyles: Record<string, unknown>;
  defaultChildren?: EditorNode[];
}

export type ComponentCategory =
  | 'Layout'
  | 'Typography'
  | 'Interactive'
  | 'Media'
  | 'Advanced';

import type { Breakpoint, ThemeConfig } from '../builder/types';

export type V2NodeType =
  | 'section'
  | 'container'
  | 'stack'
  | 'grid'
  | 'text'
  | 'heading'
  | 'button'
  | 'input'
  | 'textarea'
  | 'select'
  | 'image'
  | 'video'
  | 'icon'
  | 'link'
  | 'list'
  | 'custom';

export interface V2ResponsiveStyleSet {
  desktop?: Record<string, unknown>;
  tablet?: Record<string, unknown>;
  mobile?: Record<string, unknown>;
}

export interface V2Node {
  id: string;
  type: V2NodeType;
  component: string;
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  responsive?: V2ResponsiveStyleSet;
  children: V2Node[];
  metadata?: {
    sourceType?: string;
    tags?: string[];
  };
}

export interface V2Page {
  id: string;
  name: string;
  slug: string;
  nodes: V2Node[];
}

export interface V2Document {
  id: string;
  version: '2.0.0';
  createdAt: string;
  updatedAt: string;
  name: string;
  theme: ThemeConfig;
  activeBreakpoint: Breakpoint;
  pages: V2Page[];
}

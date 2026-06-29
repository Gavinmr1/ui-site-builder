import type { Breakpoint, EditorNode, ProjectFile } from '../../builder/types';
import type { V2Document, V2Node } from '../schema';
import { mapComponentToPrimitive } from '../primitives';

const BREAKPOINT_KEYS = new Set(['desktop', 'tablet', 'mobile']);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function splitStyles(styles: Record<string, unknown>): {
  style: Record<string, unknown>;
  responsive: V2Node['responsive'];
} {
  const style: Record<string, unknown> = {};
  const responsive: NonNullable<V2Node['responsive']> = {};

  for (const [key, value] of Object.entries(styles ?? {})) {
    if (BREAKPOINT_KEYS.has(key) && typeof value === 'object' && value !== null) {
      responsive[key as Breakpoint] = value as Record<string, unknown>;
      continue;
    }
    style[key] = value;
  }

  return {
    style,
    responsive: Object.keys(responsive).length ? responsive : undefined,
  };
}

function mapNode(node: EditorNode): V2Node {
  const { style, responsive } = splitStyles(node.styles as Record<string, unknown>);

  return {
    id: node.id,
    type: mapComponentToPrimitive(node.type),
    component: node.type,
    props: node.props,
    style,
    responsive,
    children: node.children.map(mapNode),
    metadata: {
      sourceType: node.type,
    },
  };
}

export function mapProjectToV2Document(project: ProjectFile): V2Document {
  return {
    id: project.id,
    version: '2.0.0',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    name: project.name,
    theme: project.theme,
    activeBreakpoint: 'desktop',
    pages: [
      {
        id: `${project.id}-page-1`,
        name: project.name,
        slug: slugify(project.name),
        nodes: project.pages.map(mapNode),
      },
    ],
  };
}

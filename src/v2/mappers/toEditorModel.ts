import type { EditorNode, ProjectFile } from '../../builder/types';
import type { V2Document, V2Node } from '../schema';

function mergeStyles(
  baseStyle: Record<string, unknown>,
  responsive?: V2Node['responsive']
): EditorNode['styles'] {
  return {
    ...baseStyle,
    ...(responsive?.desktop ? { desktop: responsive.desktop } : {}),
    ...(responsive?.tablet ? { tablet: responsive.tablet } : {}),
    ...(responsive?.mobile ? { mobile: responsive.mobile } : {}),
  } as EditorNode['styles'];
}

function mapNode(node: V2Node): EditorNode {
  return {
    id: node.id,
    type: node.component || node.metadata?.sourceType || node.type,
    props: { ...node.props },
    styles: mergeStyles(node.style, node.responsive),
    children: node.children.map(mapNode),
  };
}

export function mapV2DocumentToProject(document: V2Document): ProjectFile {
  const firstPage = document.pages[0];

  return {
    id: document.id,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    theme: document.theme,
    pages: (firstPage?.nodes ?? []).map(mapNode),
  };
}

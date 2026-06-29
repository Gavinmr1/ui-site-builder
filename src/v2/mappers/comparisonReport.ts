import type { ProjectFile } from '../../builder/types';
import type { V2Document } from '../schema';

interface SourceNodeSummary {
  sourceType: string;
  primitiveType: string;
  count: number;
}

export interface V2ComparisonReport {
  sourceProjectId: string;
  sourceProjectName: string;
  sourceRootNodes: number;
  sourceTotalNodes: number;
  v2RootNodes: number;
  v2TotalNodes: number;
  customFallbackCount: number;
  summaries: SourceNodeSummary[];
}

function countSourceNodes(nodes: ProjectFile['pages']): number {
  function count(nodeChildren: ProjectFile['pages'][number]['children']): number {
    return nodeChildren.reduce((total, child) => total + 1 + count(child.children), 0);
  }

  return nodes.reduce((total, node) => total + 1 + count(node.children), 0);
}

function countV2Nodes(nodes: V2Document['pages'][number]['nodes']): number {
  return nodes.reduce((total, node) => total + 1 + countV2Nodes(node.children), 0);
}

export function buildV2ComparisonReport(source: ProjectFile, v2: V2Document): V2ComparisonReport {
  const summaryMap = new Map<string, SourceNodeSummary>();

  function walk(nodes: V2Document['pages'][number]['nodes']): void {
    for (const node of nodes) {
      const sourceType = node.metadata?.sourceType ?? node.component;
      const key = `${sourceType}::${node.type}`;
      const existing = summaryMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        summaryMap.set(key, {
          sourceType,
          primitiveType: node.type,
          count: 1,
        });
      }
      walk(node.children);
    }
  }

  for (const page of v2.pages) {
    walk(page.nodes);
  }

  const summaries = [...summaryMap.values()].sort((a, b) => b.count - a.count);
  const customFallbackCount = summaries
    .filter((entry) => entry.primitiveType === 'custom')
    .reduce((total, entry) => total + entry.count, 0);

  return {
    sourceProjectId: source.id,
    sourceProjectName: source.name,
    sourceRootNodes: source.pages.length,
    sourceTotalNodes: countSourceNodes(source.pages),
    v2RootNodes: v2.pages.reduce((total, page) => total + page.nodes.length, 0),
    v2TotalNodes: v2.pages.reduce((total, page) => total + countV2Nodes(page.nodes), 0),
    customFallbackCount,
    summaries,
  };
}

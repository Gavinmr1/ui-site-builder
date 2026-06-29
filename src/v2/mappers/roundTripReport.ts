import type { ProjectFile } from '../../builder/types';
import type { V2Document } from '../schema';
import { mapV2DocumentToProject } from './toEditorModel';

function countNodes(nodes: ProjectFile['pages']): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

export interface V2RoundTripReport {
  sourceTotalNodes: number;
  roundTripTotalNodes: number;
  nodeDelta: number;
  sourceRootNodes: number;
  roundTripRootNodes: number;
  rootDelta: number;
  isStableByCount: boolean;
}

export function createV2RoundTripReport(source: ProjectFile, document: V2Document): V2RoundTripReport {
  const roundTrip = mapV2DocumentToProject(document);
  const sourceTotalNodes = countNodes(source.pages);
  const roundTripTotalNodes = countNodes(roundTrip.pages);

  const sourceRootNodes = source.pages.length;
  const roundTripRootNodes = roundTrip.pages.length;

  return {
    sourceTotalNodes,
    roundTripTotalNodes,
    nodeDelta: roundTripTotalNodes - sourceTotalNodes,
    sourceRootNodes,
    roundTripRootNodes,
    rootDelta: roundTripRootNodes - sourceRootNodes,
    isStableByCount: sourceTotalNodes === roundTripTotalNodes && sourceRootNodes === roundTripRootNodes,
  };
}

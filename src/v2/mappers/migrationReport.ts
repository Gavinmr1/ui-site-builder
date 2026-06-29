import type { ProjectFile } from '../../builder/types';
import type { V2Document } from '../schema';
import { mapProjectToV2Document } from './fromEditorModel';
import { validateV2Document, type V2ValidationIssue } from '../validation';
import { buildV2ComparisonReport, type V2ComparisonReport } from './comparisonReport';
import { createV2RoundTripReport, type V2RoundTripReport } from './roundTripReport';

function countNodes(nodes: V2Document['pages'][number]['nodes']): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

export interface V2MigrationReport {
  sourceProjectId: string;
  sourceProjectName: string;
  totalPages: number;
  totalNodes: number;
  comparison: V2ComparisonReport;
  roundTrip: V2RoundTripReport;
  valid: boolean;
  issues: V2ValidationIssue[];
  migratedAt: string;
  document: V2Document;
}

export function createV2MigrationReport(project: ProjectFile): V2MigrationReport {
  const document = mapProjectToV2Document(project);
  const validation = validateV2Document(document);
  const totalNodes = document.pages.reduce((total, page) => total + countNodes(page.nodes), 0);
  const comparison = buildV2ComparisonReport(project, document);
  const roundTrip = createV2RoundTripReport(project, document);

  return {
    sourceProjectId: project.id,
    sourceProjectName: project.name,
    totalPages: document.pages.length,
    totalNodes,
    comparison,
    roundTrip,
    valid: validation.valid,
    issues: validation.issues,
    migratedAt: new Date().toISOString(),
    document,
  };
}

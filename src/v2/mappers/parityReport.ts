import type { EditorNode, ProjectFile } from '../../builder/types';
import { mapComponentToPrimitive, getPrimitiveDefinition } from '../primitives';
import { createV2MigrationReport } from './migrationReport';

interface PrimitiveUsage {
  primitiveType: string;
  count: number;
}

interface MissingFieldIssue {
  nodeId: string;
  sourceType: string;
  primitiveType: string;
  field: string;
}

export interface V2ParityReport {
  sourceProjectId: string;
  sourceProjectName: string;
  generatedAt: string;
  totalNodes: number;
  mappedPrimitiveTypes: number;
  customFallbackCount: number;
  roundTripStableByCount: boolean;
  roundTripNodeDelta: number;
  validationIssues: number;
  missingRequiredFieldCount: number;
  qualityScore: number;
  primitiveUsage: PrimitiveUsage[];
  missingRequiredFields: MissingFieldIssue[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeQualityScore(input: {
  totalNodes: number;
  customFallbackCount: number;
  validationIssues: number;
  missingRequiredFieldCount: number;
  roundTripNodeDelta: number;
}): number {
  const base = 100;
  const { totalNodes, customFallbackCount, validationIssues, missingRequiredFieldCount, roundTripNodeDelta } = input;
  const denominator = Math.max(totalNodes, 1);

  const customFallbackPenalty = Math.round((customFallbackCount / denominator) * 45);
  const validationPenalty = Math.min(validationIssues * 8, 24);
  const missingRequiredPenalty = Math.min(missingRequiredFieldCount * 6, 18);
  const roundTripPenalty = Math.min(Math.abs(roundTripNodeDelta) * 4, 16);

  return clamp(base - customFallbackPenalty - validationPenalty - missingRequiredPenalty - roundTripPenalty, 0, 100);
}

function flatten(nodes: EditorNode[]): EditorNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function findMissingRequiredFields(nodes: EditorNode[]): MissingFieldIssue[] {
  const flat = flatten(nodes);
  const issues: MissingFieldIssue[] = [];

  for (const node of flat) {
    const primitiveType = mapComponentToPrimitive(node.type);
    const primitive = getPrimitiveDefinition(primitiveType);

    for (const field of primitive.fields) {
      if (!field.required) continue;
      const value = node.props[field.key];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (!missing) continue;

      issues.push({
        nodeId: node.id,
        sourceType: node.type,
        primitiveType,
        field: field.key,
      });
    }
  }

  return issues;
}

export function createV2ParityReport(project: ProjectFile): V2ParityReport {
  const migration = createV2MigrationReport(project);
  const flatNodes = flatten(project.pages);
  const usageMap = new Map<string, number>();

  for (const node of flatNodes) {
    const primitive = mapComponentToPrimitive(node.type);
    usageMap.set(primitive, (usageMap.get(primitive) ?? 0) + 1);
  }

  const primitiveUsage = [...usageMap.entries()]
    .map(([primitiveType, count]) => ({ primitiveType, count }))
    .sort((a, b) => b.count - a.count);

  const missingRequiredFields = findMissingRequiredFields(project.pages);
  const qualityScore = computeQualityScore({
    totalNodes: migration.totalNodes,
    customFallbackCount: migration.comparison.customFallbackCount,
    validationIssues: migration.issues.length,
    missingRequiredFieldCount: missingRequiredFields.length,
    roundTripNodeDelta: migration.roundTrip.nodeDelta,
  });

  return {
    sourceProjectId: project.id,
    sourceProjectName: project.name,
    generatedAt: new Date().toISOString(),
    totalNodes: migration.totalNodes,
    mappedPrimitiveTypes: primitiveUsage.length,
    customFallbackCount: migration.comparison.customFallbackCount,
    roundTripStableByCount: migration.roundTrip.isStableByCount,
    roundTripNodeDelta: migration.roundTrip.nodeDelta,
    validationIssues: migration.issues.length,
    missingRequiredFieldCount: missingRequiredFields.length,
    qualityScore,
    primitiveUsage,
    missingRequiredFields,
  };
}

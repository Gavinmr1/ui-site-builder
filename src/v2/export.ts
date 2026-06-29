import JSZip from 'jszip';
import type { ProjectFile } from '../builder/types';
import { createV2MigrationReport } from './mappers/migrationReport';
import { createV2ParityReport } from './mappers/parityReport';
import { recordParitySnapshot } from './parityHistory';
import {
  generateV2ReactTailwindPage,
  generateV2ReactTailwindProjectFiles,
} from './exporters/reactTailwind';

function sanitizeFileName(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface V2ExportMeta {
  valid: boolean;
  issues: number;
  totalNodes: number;
  customFallbackCount: number;
  roundTripNodeDelta: number;
  roundTripStableByCount: boolean;
  missingRequiredFieldCount?: number;
  qualityScore?: number;
}

function toExportMeta(report: ReturnType<typeof createV2MigrationReport>): V2ExportMeta {
  return {
    valid: report.valid,
    issues: report.issues.length,
    totalNodes: report.totalNodes,
    customFallbackCount: report.comparison.customFallbackCount,
    roundTripNodeDelta: report.roundTrip.nodeDelta,
    roundTripStableByCount: report.roundTrip.isStableByCount,
  };
}

export function downloadV2MigrationSnapshot(project: ProjectFile): V2ExportMeta {
  const report = createV2MigrationReport(project);
  const baseName = sanitizeFileName(project.name);
  downloadTextFile(
    `${baseName}.v2-migration.json`,
    JSON.stringify(report, null, 2),
    'application/json;charset=utf-8'
  );
  return toExportMeta(report);
}

export function downloadV2ParityReport(project: ProjectFile): V2ExportMeta {
  const migration = createV2MigrationReport(project);
  const parity = createV2ParityReport(project);
  const baseName = sanitizeFileName(project.name);

  downloadTextFile(
    `${baseName}.v2-parity-report.json`,
    JSON.stringify(parity, null, 2),
    'application/json;charset=utf-8'
  );

  recordParitySnapshot({
    projectId: project.id,
    projectName: project.name,
    qualityScore: parity.qualityScore,
    customFallbackCount: parity.customFallbackCount,
    missingRequiredFieldCount: parity.missingRequiredFieldCount,
    validationIssues: parity.validationIssues,
    roundTripNodeDelta: parity.roundTripNodeDelta,
    totalNodes: parity.totalNodes,
    source: 'export',
  });

  return {
    ...toExportMeta(migration),
    missingRequiredFieldCount: parity.missingRequiredFieldCount,
    qualityScore: parity.qualityScore,
  };
}

export function downloadV2ReactTailwindPage(project: ProjectFile): V2ExportMeta {
  const report = createV2MigrationReport(project);
  const baseName = sanitizeFileName(project.name);
  const code = generateV2ReactTailwindPage(report.document);
  downloadTextFile(`${baseName}.v2.page.tsx`, code, 'text/plain;charset=utf-8');
  return toExportMeta(report);
}

export async function downloadV2ReactTailwindProjectZip(project: ProjectFile): Promise<V2ExportMeta> {
  const report = createV2MigrationReport(project);
  const baseName = sanitizeFileName(project.name);
  const files = generateV2ReactTailwindProjectFiles(report.document);
  const zip = new JSZip();

  for (const [filePath, content] of Object.entries(files)) {
    zip.file(filePath, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseName}.v2-react-tailwind.zip`;
  anchor.click();
  URL.revokeObjectURL(url);

  return toExportMeta(report);
}

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Icon } from './Icon';
import { renderNode } from '../renderer/NodeRenderer';
import { getPageHtml } from '../export/codeExporter';
import type { Breakpoint, EditorNode } from '../types';
import { getThemeCssVars, themeVar } from '../themes/themeTokens';
import { trackEvent } from '../analytics';
import { createV2MigrationReport } from '../../v2/mappers/migrationReport';
import { mapV2DocumentToProject } from '../../v2/mappers/toEditorModel';
import { createV2ParityReport } from '../../v2/mappers/parityReport';
import { getScoreTrend, recordParitySnapshot } from '../../v2/parityHistory';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeviceType = 'desktop' | 'iphone' | 'ipad' | 'macbook';
type PreviewMode = 'legacy' | 'v2' | 'split';

interface NodeSignature {
  type: string;
  propKeyCount: number;
  styleKeyCount: number;
}

interface TreeDiffSummary {
  legacyNodeCount: number;
  v2NodeCount: number;
  missingInV2Count: number;
  newInV2Count: number;
  typeChangedCount: number;
  propShapeChangedCount: number;
  styleShapeChangedCount: number;
}

interface TreeDiffDetails {
  summary: TreeDiffSummary;
  legacyDiffById: Map<string, string[]>;
  v2DiffById: Map<string, string[]>;
}

function filterHiddenNodes(nodes: EditorNode[], hiddenIds: Set<string>): EditorNode[] {
  return nodes
    .filter((node) => !hiddenIds.has(node.id))
    .map((node) => ({
      ...node,
      children: filterHiddenNodes(node.children, hiddenIds),
    }));
}

function breakpointForDevice(device: DeviceType): Breakpoint {
  if (device === 'iphone') return 'mobile';
  if (device === 'ipad') return 'tablet';
  return 'desktop';
}

function renderPreviewTree(
  nodes: EditorNode[],
  breakpoint: Breakpoint,
  diffById?: Map<string, string[]>,
  onFocusNode?: (nodeId: string) => void
): React.ReactNode {
  return nodes.map((node) => {
    const children = renderPreviewTree(node.children, breakpoint, diffById, onFocusNode);
    const nodeDiffReasons = diffById?.get(node.id) ?? [];
    const hasDiff = nodeDiffReasons.length > 0;

    const primaryReason = nodeDiffReasons[0] ?? '';
    const isHardDiff = primaryReason === 'missing-in-v2' || primaryReason === 'new-in-v2';

    const badgeToneClass =
      primaryReason === 'missing-in-v2'
        ? 'border-rose-700 bg-rose-500/20 text-rose-200'
        : primaryReason === 'new-in-v2'
          ? 'border-amber-700 bg-amber-500/20 text-amber-200'
          : 'border-fuchsia-700 bg-fuchsia-500/20 text-fuchsia-200';

    return (
      <div
        key={node.id}
        className={hasDiff ? 'relative' : undefined}
        style={
          hasDiff
            ? {
                boxShadow: isHardDiff
                  ? 'inset 0 0 0 2px rgba(244,63,94,0.7)'
                  : 'inset 0 0 0 2px rgba(217,70,239,0.65)',
                borderRadius: 4,
              }
            : undefined
        }
      >
        {hasDiff && (
          <button
            type="button"
            className={`absolute -top-2 right-1 z-20 rounded border px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${badgeToneClass}`}
            title={nodeDiffReasons.join(', ')}
            onClick={(e) => {
              e.stopPropagation();
              onFocusNode?.(node.id);
            }}
          >
            {primaryReason.replace(/-/g, ' ')}
          </button>
        )}
        {renderNode(node, false, children, breakpoint)}
      </div>
    );
  });
}

function collectNodeIds(nodes: EditorNode[]): Set<string> {
  const ids = new Set<string>();

  function walk(current: EditorNode[]): void {
    for (const node of current) {
      ids.add(node.id);
      walk(node.children);
    }
  }

  walk(nodes);
  return ids;
}

function flattenNodeSignatures(nodes: EditorNode[]): Map<string, NodeSignature> {
  const map = new Map<string, NodeSignature>();

  function walk(current: EditorNode[]): void {
    for (const node of current) {
      const styleKeys = Object.keys(node.styles ?? {}).filter(
        (key) => key !== 'desktop' && key !== 'tablet' && key !== 'mobile'
      );

      map.set(node.id, {
        type: node.type,
        propKeyCount: Object.keys(node.props ?? {}).length,
        styleKeyCount: styleKeys.length,
      });

      walk(node.children);
    }
  }

  walk(nodes);
  return map;
}

function compareTrees(legacyNodes: EditorNode[], v2Nodes: EditorNode[]): TreeDiffDetails {
  const legacyMap = flattenNodeSignatures(legacyNodes);
  const v2Map = flattenNodeSignatures(v2Nodes);
  const legacyDiffById = new Map<string, string[]>();
  const v2DiffById = new Map<string, string[]>();

  let missingInV2Count = 0;
  let typeChangedCount = 0;
  let propShapeChangedCount = 0;
  let styleShapeChangedCount = 0;

  for (const [id, legacyNode] of legacyMap.entries()) {
    const v2Node = v2Map.get(id);
    if (!v2Node) {
      missingInV2Count += 1;
      legacyDiffById.set(id, ['missing-in-v2']);
      continue;
    }

    const reasons: string[] = [];

    if (legacyNode.type !== v2Node.type) {
      typeChangedCount += 1;
      reasons.push('type-changed');
    }
    if (legacyNode.propKeyCount !== v2Node.propKeyCount) {
      propShapeChangedCount += 1;
      reasons.push('prop-shape-changed');
    }
    if (legacyNode.styleKeyCount !== v2Node.styleKeyCount) {
      styleShapeChangedCount += 1;
      reasons.push('style-shape-changed');
    }

    if (reasons.length > 0) {
      legacyDiffById.set(id, reasons);
      v2DiffById.set(id, reasons);
    }
  }

  let newInV2Count = 0;
  for (const id of v2Map.keys()) {
    if (!legacyMap.has(id)) {
      newInV2Count += 1;
      v2DiffById.set(id, ['new-in-v2']);
    }
  }

  return {
    summary: {
      legacyNodeCount: legacyMap.size,
      v2NodeCount: v2Map.size,
      missingInV2Count,
      newInV2Count,
      typeChangedCount,
      propShapeChangedCount,
      styleShapeChangedCount,
    },
    legacyDiffById,
    v2DiffById,
  };
}

export function PreviewModal({ isOpen, onClose }: PreviewModalProps) {
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [showCode, setShowCode] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('legacy');
  const pageTree = useEditorStore((state) => state.pageTree);
  const hiddenNodeIds = useEditorStore((state) => state.hiddenNodeIds);
  const theme = useEditorStore((state) => state.theme);
  const projectName = useEditorStore((state) => state.projectName);
  const createProjectSnapshot = useEditorStore((state) => state.createProjectSnapshot);
  const selectNode = useEditorStore((state) => state.selectNode);
  const setBreakpoint = useEditorStore((state) => state.setBreakpoint);

  const breakpoint = breakpointForDevice(deviceType);

  const visibleTree = useMemo(
    () => filterHiddenNodes(pageTree, new Set(hiddenNodeIds)),
    [pageTree, hiddenNodeIds]
  );

  const projectSnapshot = useMemo(
    () => createProjectSnapshot(),
    [createProjectSnapshot, pageTree, hiddenNodeIds, theme, projectName]
  );

  const v2Migration = useMemo(
    () => createV2MigrationReport(projectSnapshot),
    [projectSnapshot]
  );

  const v2Parity = useMemo(
    () => createV2ParityReport(projectSnapshot),
    [projectSnapshot]
  );

  const v2VisibleTree = useMemo(() => {
    const roundTripped = mapV2DocumentToProject(v2Migration.document);
    return filterHiddenNodes(roundTripped.pages, new Set(hiddenNodeIds));
  }, [v2Migration.document, hiddenNodeIds]);

  const renderedTree = previewMode === 'legacy' ? visibleTree : v2VisibleTree;
  const diffDetails = useMemo(
    () => compareTrees(visibleTree, v2VisibleTree),
    [visibleTree, v2VisibleTree]
  );
  const diffSummary = diffDetails.summary;
  const sourceNodeIds = useMemo(() => collectNodeIds(pageTree), [pageTree]);

  const [scoreTrend, setScoreTrend] = useState<{ recordedAt: string; score: number }[]>([]);

  useEffect(() => {
    if (previewMode !== 'split') return;
    recordParitySnapshot({
      projectId: projectSnapshot.id,
      projectName: projectSnapshot.name,
      qualityScore: v2Parity.qualityScore,
      customFallbackCount: v2Parity.customFallbackCount,
      missingRequiredFieldCount: v2Parity.missingRequiredFieldCount,
      validationIssues: v2Parity.validationIssues,
      roundTripNodeDelta: v2Parity.roundTripNodeDelta,
      totalNodes: v2Parity.totalNodes,
      source: 'preview',
    });
    setScoreTrend(getScoreTrend(20));
  // Only fire when previewMode flips to split or project changes — not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode === 'split' ? projectSnapshot.id + projectSnapshot.updatedAt : null, previewMode]);

  const htmlContent = useMemo(() => getPageHtml(projectName), [projectName, pageTree, theme]);

  if (!isOpen) return null;

  const deviceDimensions: Record<DeviceType, { width: number; height: number; scale: number }> = {
    desktop: { width: 1920, height: 1080, scale: 0.6 },
    iphone: { width: 375, height: 812, scale: 1 },
    ipad: { width: 768, height: 1024, scale: 0.75 },
    macbook: { width: 1440, height: 900, scale: 0.7 },
  };

  const device = deviceDimensions[deviceType];
  const scale = previewMode === 'split' ? device.scale * 0.62 : device.scale;

  function focusNodeInEditor(nodeId: string): void {
    if (!sourceNodeIds.has(nodeId)) return;
    setBreakpoint(breakpoint);
    selectNode(nodeId);
    trackEvent('preview_opened', {
      mode: 'split',
      source: 'split-diff-focus',
      nodeId,
    });
    onClose();
  }

  function renderDeviceFrame(
    nodes: EditorNode[],
    label: string,
    diffById?: Map<string, string[]>
  ): React.ReactNode {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div
          style={{
            width: `${device.width * scale}px`,
            height: `${device.height * scale}px`,
            borderRadius: deviceType === 'desktop' ? '0px' : '24px',
          }}
          className="flex flex-col overflow-hidden border-8 border-slate-800 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          {deviceType !== 'desktop' && (
            <div className="flex h-5 items-center justify-center rounded-t-[12px] bg-black">
              <div className="h-1.5 w-2/5 rounded-b-lg bg-black" />
            </div>
          )}

          <div
            className="flex-1 overflow-auto"
            style={{
              ...getThemeCssVars(theme),
              backgroundColor: themeVar.background,
              color: themeVar.text,
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.baseFontSize,
            }}
          >
            {nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm opacity-70">
                Add components to the canvas to preview your page.
              </div>
            ) : (
              renderPreviewTree(nodes, breakpoint, diffById, focusNodeInEditor)
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col bg-black/80"
      onClick={onClose}
    >
      <div
        className="z-[1001] flex items-center justify-between border-b border-slate-800 bg-slate-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent">Preview</h2>
          <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/80 p-1">
            <button
              onClick={() => {
                setPreviewMode('legacy');
                trackEvent('preview_opened', { mode: 'legacy', source: 'preview-modal-toggle' });
              }}
              className={`cursor-pointer rounded px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${previewMode === 'legacy' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400'}`}
            >
              Legacy
            </button>
            <button
              onClick={() => {
                setPreviewMode('v2');
                trackEvent('preview_opened', { mode: 'v2', source: 'preview-modal-toggle' });
              }}
              className={`cursor-pointer rounded px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${previewMode === 'v2' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400'}`}
            >
              V2
            </button>
            <button
              onClick={() => {
                setPreviewMode('split');
                trackEvent('preview_opened', { mode: 'split', source: 'preview-modal-toggle' });
              }}
              className={`cursor-pointer rounded px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${previewMode === 'split' ? 'bg-amber-500/15 text-amber-300' : 'text-slate-400'}`}
            >
              Split
            </button>
          </div>
          <div className="text-[0.68rem] text-slate-400">
            score <span className="font-semibold text-emerald-300">{v2Parity.qualityScore}</span>/100
            <span className="mx-1.5 text-slate-600">|</span>
            fallback <span className="font-semibold text-amber-300">{v2Migration.comparison.customFallbackCount}</span>
            <span className="mx-1.5 text-slate-600">|</span>
            delta <span className="font-semibold text-cyan-300">{v2Migration.roundTrip.nodeDelta}</span>
            {previewMode === 'split' && (
              <>
                <span className="mx-1.5 text-slate-600">|</span>
                mismatch <span className="font-semibold text-rose-300">
                  {diffSummary.missingInV2Count + diffSummary.newInV2Count + diffSummary.typeChangedCount + diffSummary.propShapeChangedCount + diffSummary.styleShapeChangedCount}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1">
            {(['desktop', 'iphone', 'ipad', 'macbook'] as DeviceType[]).map((device) => (
              <button
                key={device}
                onClick={() => setDeviceType(device)}
                className={`cursor-pointer rounded px-3 py-1.5 text-xs font-medium capitalize ${deviceType === device ? 'border-2 border-cyan-400 bg-cyan-400/10 text-cyan-400' : 'border border-slate-700 bg-transparent text-slate-400'}`}
              >
                {device}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowCode(!showCode)}
            title="Toggle Code View"
            className={`flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 px-3 py-2 text-xs font-medium ${showCode ? 'text-cyan-400' : 'text-slate-400'}`}
          >
            <Icon name="code" size={16} />
            Code
          </button>
          <button
            onClick={onClose}
            title="Close Preview"
            className="flex cursor-pointer items-center gap-1.5 rounded border border-slate-700 bg-transparent px-3 py-2 text-slate-400"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      <div
        className="z-[1001] flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {showCode ? (
          <div className="max-h-full w-full max-w-[900px] overflow-auto rounded-lg border border-slate-700 bg-slate-800 p-4 font-mono text-xs text-slate-300">
            <pre className="whitespace-pre-wrap break-words">{htmlContent}</pre>
          </div>
        ) : (
          <div className="flex w-full max-w-[1500px] flex-col gap-3">
            {previewMode === 'split' && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-[0.72rem] text-slate-300">
                <div>Legacy nodes: <span className="font-semibold text-cyan-300">{diffSummary.legacyNodeCount}</span></div>
                <div>V2 nodes: <span className="font-semibold text-emerald-300">{diffSummary.v2NodeCount}</span></div>
                <div>Missing in V2: <span className="font-semibold text-rose-300">{diffSummary.missingInV2Count}</span></div>
                <div>New in V2: <span className="font-semibold text-amber-300">{diffSummary.newInV2Count}</span></div>
                <div>Type changed: <span className="font-semibold text-fuchsia-300">{diffSummary.typeChangedCount}</span></div>
                <div>Prop shape changed: <span className="font-semibold text-indigo-300">{diffSummary.propShapeChangedCount}</span></div>
                <div className="col-span-2">Style shape changed: <span className="font-semibold text-sky-300">{diffSummary.styleShapeChangedCount}</span></div>
              </div>
            )}

            {previewMode === 'split' && scoreTrend.length > 1 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <div className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Quality score trend ({scoreTrend.length} samples)
                </div>
                <div className="flex h-10 items-end gap-0.5">
                  {scoreTrend.map((point, i) => {
                    const heightPct = Math.max(4, point.score);
                    const isLatest = i === scoreTrend.length - 1;
                    const color =
                      point.score >= 80
                        ? isLatest ? 'bg-emerald-400' : 'bg-emerald-700'
                        : point.score >= 50
                          ? isLatest ? 'bg-amber-400' : 'bg-amber-700'
                          : isLatest ? 'bg-rose-400' : 'bg-rose-800';
                    return (
                      <div
                        key={point.recordedAt}
                        title={`${point.score}/100 at ${new Date(point.recordedAt).toLocaleTimeString()}`}
                        className={`flex-1 rounded-sm ${color} transition-all`}
                        style={{ height: `${heightPct}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[0.62rem] text-slate-600">
                  <span>{scoreTrend[0] ? new Date(scoreTrend[0].recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <span className="text-slate-400">latest: <span className="font-semibold text-emerald-300">{scoreTrend[scoreTrend.length - 1]?.score ?? '—'}</span>/100</span>
                  <span>{scoreTrend[scoreTrend.length - 1] ? new Date(scoreTrend[scoreTrend.length - 1].recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
              </div>
            )}

            {previewMode === 'split' ? (
              <div className="flex w-full items-start justify-center gap-4 overflow-auto">
                {renderDeviceFrame(visibleTree, 'Legacy Render', diffDetails.legacyDiffById)}
                {renderDeviceFrame(v2VisibleTree, 'V2 Render', diffDetails.v2DiffById)}
              </div>
            ) : (
              <div className="flex w-full items-center justify-center overflow-auto">
                {renderDeviceFrame(renderedTree, previewMode === 'legacy' ? 'Legacy Render' : 'V2 Render')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-800 bg-slate-900 px-4 py-3 text-center text-xs text-slate-500">
        Click outside or press ESC to close
      </div>
    </div>
  );
}

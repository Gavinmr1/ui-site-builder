import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  useDroppable,
} from '@dnd-kit/core';
import { useEditorStore } from '../store/editorStore';
import { Icon } from '../components/Icon';
import { EditorNodeWrapper, renderNode } from '../renderer/NodeRenderer';
import { getSelectionRect, toRelativePoint, collectIntersectingNodeIds, type SelectionBox } from '../utils/marqueeSelection';
import type { Breakpoint, EditorNode } from '../types';
import { getThemeCssVars, themeVar } from '../themes/themeTokens';

const BREAKPOINTS: { value: Breakpoint; label: string; icon: string }[] = [
  { value: 'desktop', label: 'Desktop', icon: '🖥' },
  { value: 'tablet', label: 'Tablet', icon: '📱' },
  { value: 'mobile', label: 'Mobile', icon: '📲' },
];

function filterHiddenNodes(nodes: EditorNode[], hiddenIds: Set<string>): EditorNode[] {
  return nodes
    .filter((node) => !hiddenIds.has(node.id))
    .map((node) => ({
      ...node,
      children: filterHiddenNodes(node.children, hiddenIds),
    }));
}

// ─── Droppable Canvas Area ────────────────────────────────────────────────────

interface DroppableCanvasProps {
  children: React.ReactNode;
  onMarqueeSelect?: (nodeIds: string[]) => void;
}

function DroppableCanvas({ children, onMarqueeSelect }: DroppableCanvasProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: 'canvas-root' });
  const { clearSelection, stopTextEditing } = useEditorStore();
  const [marqueeBox, setMarqueeBox] = useState<SelectionBox | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target !== e.currentTarget) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = toRelativePoint(e.clientX, e.clientY, canvas);
    setMarqueeBox({ startX: start.x, startY: start.y, endX: start.x, endY: start.y });
    stopTextEditing();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!marqueeBox) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const end = toRelativePoint(e.clientX, e.clientY, canvas);

    setMarqueeBox((prev) =>
      prev ? { ...prev, endX: end.x, endY: end.y } : null
    );
  };

  const handleMouseUp = () => {
    if (!marqueeBox) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      setMarqueeBox(null);
      return;
    }

    const selectionRect = getSelectionRect(marqueeBox);
    const selectedNodeIds = collectIntersectingNodeIds(canvas, selectionRect);

    if (selectedNodeIds.length > 0) {
      onMarqueeSelect?.(selectedNodeIds);
    } else {
      clearSelection();
    }

    setMarqueeBox(null);
  };

  const marqueeRect = marqueeBox ? getSelectionRect(marqueeBox) : null;

  return (
    <div
      ref={(el) => {
        setDroppableRef(el);
        if (el) {
          canvasRef.current = el;
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        stopTextEditing();
        clearSelection();
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative h-full min-h-[600px] w-full select-none"
      style={{
        outline: isOver ? '2px dashed #6366f1' : 'none',
        outlineOffset: '-4px',
      }}
    >
      {children}
      
      {/* Marquee selection box */}
      {marqueeRect && (
        <div
          style={{
            position: 'absolute',
            left: `${marqueeRect.x}px`,
            top: `${marqueeRect.y}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '2px solid #6366f1',
            borderRadius: '2px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        />
      )}

      {!children && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-600">
          <p className="mb-2 text-lg">Drop components here</p>
          <p className="text-sm">Drag from the left panel to get started</p>
        </div>
      )}
    </div>
  );
}

// ─── Editor Node (interactive wrapper) ────────────────────────────────────────

function EditableNode({ node, activeBreakpoint }: { node: EditorNode; activeBreakpoint: Breakpoint }) {
  const textEditingNodeId = useEditorStore((s) => s.textEditingNodeId);
  const renderedChildren = node.children.map((child) => (
    <EditableNode key={child.id} node={child} activeBreakpoint={activeBreakpoint} />
  ));

  return (
    <EditorNodeWrapper node={node}>
      {renderNode(node, textEditingNodeId === node.id, renderedChildren, activeBreakpoint)}
    </EditorNodeWrapper>
  );
}

// ─── Responsive frame widths ──────────────────────────────────────────────────

const FRAME_CONFIG: Record<Breakpoint, { width: string; radius: string; safeInset: number }> = {
  desktop: { width: '100%', radius: '0px', safeInset: 0 },
  tablet: { width: '820px', radius: '22px', safeInset: 14 },
  mobile: { width: '410px', radius: '28px', safeInset: 12 },
};

function PageToolbarButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex min-h-[30px] items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-[0.78125rem] transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${active ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-slate-800 text-slate-400 hover:bg-slate-950 hover:text-slate-200'}`}
    >
      {children}
    </button>
  );
}

function PageToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-slate-800" />;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas({
  onPreviewClick,
  onCodePanelToggle,
  showCodePanel,
}: {
  onPreviewClick: () => void;
  onCodePanelToggle: () => void;
  showCodePanel: boolean;
}) {
  const {
    pageTree,
    hiddenNodeIds,
    undoStack,
    redoStack,
    undo,
    redo,
    activeBreakpoint,
    setBreakpoint,
    canvasZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setSelectedNodeIds,
    selectedNodeId,
    selectNode,
    theme,
  } = useEditorStore();
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGrid((value) => !value);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const frameConfig = FRAME_CONFIG[activeBreakpoint];
  const visibleTree = React.useMemo(
    () => filterHiddenNodes(pageTree, new Set(hiddenNodeIds)),
    [pageTree, hiddenNodeIds]
  );
  const totalHistorySteps = undoStack.length + 1 + redoStack.length;
  const currentHistoryIndex = undoStack.length;

  function jumpToHistoryIndex(targetIndex: number) {
    const delta = targetIndex - currentHistoryIndex;
    if (delta === 0) return;
    if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i += 1) {
        undo();
      }
      return;
    }
    for (let i = 0; i < delta; i += 1) {
      redo();
    }
  }

  const handleMarqueeSelect = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
  }, [setSelectedNodeIds]);

  // Build breadcrumb path
  function getNodePath(nodes: EditorNode[], targetId: string, path: EditorNode[] = []): EditorNode[] | null {
    for (const node of nodes) {
      const newPath = [...path, node];
      if (node.id === targetId) return newPath;
      const found = getNodePath(node.children, targetId, newPath);
      if (found) return found;
    }
    return null;
  }
  const breadcrumbs = selectedNodeId ? getNodePath(pageTree, selectedNodeId) ?? [] : [];

  return (
    <div className="canvas-viewport flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-900">
      <div className="sticky top-0 z-[120] min-h-[48px] shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-slate-600">
            Page Tools
          </span>

          <PageToolbarDivider />

          <span className="text-xs font-medium text-slate-400">
            {BREAKPOINTS.find((bp) => bp.value === activeBreakpoint)?.label}
          </span>
          {BREAKPOINTS.map((bp) => (
            <PageToolbarButton
              key={bp.value}
              onClick={() => setBreakpoint(bp.value)}
              active={activeBreakpoint === bp.value}
              title={bp.label}
            >
              <span className="text-base">{bp.icon}</span>
            </PageToolbarButton>
          ))}

          <PageToolbarDivider />

          <PageToolbarButton onClick={zoomOut} title="Zoom out (Ctrl+-)">
            -
          </PageToolbarButton>
          <PageToolbarButton onClick={resetZoom} title="Reset zoom (Ctrl+0)">
            {(canvasZoom * 100).toFixed(0)}%
          </PageToolbarButton>
          <PageToolbarButton onClick={zoomIn} title="Zoom in (Ctrl++)">
            +
          </PageToolbarButton>

          <PageToolbarDivider />

          <PageToolbarButton onClick={() => setShowGrid((v) => !v)} active={showGrid} title={showGrid ? 'Hide grid' : 'Show grid'}>
            Grid
          </PageToolbarButton>
          <PageToolbarButton onClick={onPreviewClick} title="Preview page">
            <Icon name="preview" size={16} />
            Preview
          </PageToolbarButton>
          <PageToolbarButton onClick={onCodePanelToggle} active={showCodePanel} title="Toggle code panel">
            <Icon name="code" size={16} />
            Code
          </PageToolbarButton>

          <PageToolbarDivider />

          <PageToolbarButton onClick={undo} title="Undo (Ctrl+Z)" active={undoStack.length > 0}>
            Undo
          </PageToolbarButton>
          <PageToolbarButton onClick={redo} title="Redo (Ctrl+Y / Ctrl+Shift+Z)" active={redoStack.length > 0}>
            Redo
          </PageToolbarButton>
        </div>

        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-600">
            History
          </span>
          {Array.from({ length: totalHistorySteps }).map((_, index) => {
            const state =
              index < currentHistoryIndex ? 'past' : index === currentHistoryIndex ? 'current' : 'future';
            const label =
              state === 'current'
                ? `Current state (${index + 1}/${totalHistorySteps})`
                : state === 'past'
                ? `Jump back ${currentHistoryIndex - index} step${currentHistoryIndex - index === 1 ? '' : 's'}`
                : `Jump forward ${index - currentHistoryIndex} step${index - currentHistoryIndex === 1 ? '' : 's'}`;

            return (
              <button
                key={`history-step-${index}`}
                type="button"
                onClick={() => jumpToHistoryIndex(index)}
                title={label}
                aria-label={label}
                className={`h-2.5 w-2.5 shrink-0 cursor-pointer rounded-full border p-0 ${
                  state === 'current'
                    ? 'border-cyan-300 bg-cyan-300'
                    : state === 'past'
                    ? 'border-slate-500 bg-slate-500/80 hover:border-slate-300 hover:bg-slate-300'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-700'
                }`}
              />
            );
          })}
          <span className="shrink-0 text-[0.68rem] text-slate-500">
            {currentHistoryIndex + 1} / {totalHistorySteps}
          </span>
        </div>
      </div>

      {/* Breadcrumb bar */}
      <div className="sticky top-[48px] z-[110] flex h-[30px] shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap border-b border-slate-800 bg-slate-900/95 px-4 text-xs text-slate-600 backdrop-blur">
        <button
          type="button"
          onClick={() => selectNode(null)}
          className="cursor-pointer rounded border-0 bg-none px-1 py-0.5 text-xs text-slate-600"
        >
          Page
        </button>
        {breadcrumbs.map((node, i) => (
          <React.Fragment key={node.id}>
            <span className="text-slate-700">›</span>
            <button
              type="button"
              onClick={() => selectNode(node.id)}
              className={`cursor-pointer rounded border-0 bg-none px-1 py-0.5 text-xs ${i === breadcrumbs.length - 1 ? 'font-semibold text-cyan-400' : 'font-normal text-slate-500'}`}
            >
              {node.type}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-1 justify-center overflow-auto p-6">
        <div
          style={{
            width: frameConfig.width,
            maxWidth: '100%',
            minHeight: '600px',
            transition: 'width 0.3s ease',
            zoom: canvasZoom,
            borderRadius: frameConfig.radius,
            ...getThemeCssVars(theme),
            backgroundColor: themeVar.background,
            color: themeVar.text,
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.baseFontSize,
          }}
          className={`relative min-h-[600px] overflow-hidden ${activeBreakpoint === 'desktop' ? '' : 'border border-slate-700/90 shadow-[0_16px_60px_rgba(2,6,23,0.55)]'}`}
        >
          {showGrid && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}

          {activeBreakpoint !== 'desktop' && (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: activeBreakpoint === 'mobile' ? '36%' : '24%',
                  height: '10px',
                  borderRadius: '999px',
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  zIndex: 1001,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: `${frameConfig.safeInset}px`,
                  border: '1px dashed rgba(56, 189, 248, 0.45)',
                  borderRadius: '14px',
                  zIndex: 1000,
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          <DroppableCanvas onMarqueeSelect={handleMarqueeSelect}>
            {visibleTree.length > 0 &&
              visibleTree.map((node) => (
                <EditableNode key={node.id} node={node} activeBreakpoint={activeBreakpoint} />
              ))}
          </DroppableCanvas>
        </div>
      </div>
    </div>
  );
}

import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Toolbar } from './builder/panels/Toolbar';
import { ToastContainer } from './builder/components/Toast';
import { useEditorStore } from './builder/store/editorStore';
import { componentDefinitions } from './builder/components/registry';
import {
  loadProjectFromLocalStorage,
  saveProjectToLocalStorage,
} from './builder/persistence/projectStorage';
import { createSampleWebsite } from './builder/utils/sampleWebsite';
import { instantiateTemplateNode, loadTemplates } from './builder/utils/templates';
import { loadAssets } from './builder/utils/assets';
import { trackEvent } from './builder/analytics';
import './styles/scrollbars.css';
import type { EditorNode } from './builder/types';
import type { DropPosition } from './builder/store/editorStore';

const ResizableLayout = lazy(() =>
  import('./builder/panels/ResizableLayout').then((module) => ({ default: module.ResizableLayout }))
);
const CodePanel = lazy(() =>
  import('./builder/panels/CodePanel').then((module) => ({ default: module.CodePanel }))
);
const BulkActionsToolbar = lazy(() =>
  import('./builder/panels/BulkActionsToolbar').then((module) => ({ default: module.BulkActionsToolbar }))
);
const KeyboardShortcutsModal = lazy(() =>
  import('./builder/panels/KeyboardShortcutsModal').then((module) => ({ default: module.KeyboardShortcutsModal }))
);
const PreviewModal = lazy(() =>
  import('./builder/components/PreviewModal').then((module) => ({ default: module.PreviewModal }))
);

interface DragGuides {
  xLines: number[];
  yLines: number[];
}

interface DragMetrics {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const CHILD_CONTAINER_TYPES = new Set(['section', 'container', 'flex-row', 'flex-col', 'grid', 'hero']);
const INLINE_EDITABLE_TYPES = new Set(['heading', 'paragraph', 'label', 'badge', 'button', 'hero', 'footer']);

function isContainerType(type: string): boolean {
  return CHILD_CONTAINER_TYPES.has(type);
}

function findNodeMeta(
  nodes: EditorNode[],
  id: string,
  parentId: string | null = null
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === id) return { parentId, index: i };
    const found = findNodeMeta(node.children, id, node.id);
    if (found) return found;
  }
  return null;
}

function containsNodeId(node: EditorNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  return node.children.some((child) => containsNodeId(child, targetId));
}

function getDropPosition(
  overType: string | null,
  left: number,
  top: number,
  width: number,
  height: number,
  pointerX: number,
  pointerY: number
): DropPosition {
  const relativeX = pointerX - left;
  const relativeY = pointerY - top;

  if (overType && isContainerType(overType)) {
    const verticalEdgeSize = Math.max(18, Math.min(36, height * 0.22));
    const horizontalEdgeSize = Math.max(14, Math.min(28, width * 0.12));

    const inTopBoundary = relativeY <= verticalEdgeSize;
    const inBottomBoundary = relativeY >= height - verticalEdgeSize;
    const inLeftBoundary = relativeX <= horizontalEdgeSize;
    const inRightBoundary = relativeX >= width - horizontalEdgeSize;
    const inBoundary = inTopBoundary || inBottomBoundary || inLeftBoundary || inRightBoundary;

    if (!inBoundary) {
      return 'inside';
    }

    if (inTopBoundary) return 'before';
    if (inBottomBoundary) return 'after';

    return relativeY < height / 2 ? 'before' : 'after';
  }

  return relativeY < height / 2 ? 'before' : 'after';
}

export function App() {
  const {
    undo,
    redo,
    addNode,
    moveNode,
    getNode,
    selectedNodeId,
    selectedNodeIds,
    removeNode,
    removeNodes,
    duplicateNode,
    copyNode,
    pasteNode,
    copyNodeStyles,
    pasteNodeStyles,
    zoomIn,
    zoomOut,
    resetZoom,
    textEditingNodeId,
    stopTextEditing,
    startTextEditing,
    closeNodeContextMenu,
    setDropIndicator,
    clearDropIndicator,
    dropIndicator,
    markPersisted,
    loadProjectFile,
    createProjectSnapshot,
    pageTree,
    theme,
    projectName,
    isNodeLocked,
    selectNode,
  } = useEditorStore();
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [dragGuides, setDragGuides] = useState<DragGuides | null>(null);
  const [dragMetrics, setDragMetrics] = useState<DragMetrics | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);
  const didBootstrap = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Show keyboard shortcuts on Cmd/Ctrl+Shift+/ or plain Shift+/.
      const isQuestionMarkKey = e.key === '?' || (e.key === '/' && e.shiftKey);

      if ((e.ctrlKey || e.metaKey) && isQuestionMarkKey) {
        e.preventDefault();
        setShowShortcutsModal(true);
        trackEvent('shortcuts_opened', { source: 'keyboard-modified' });
        return;
      }
      if (isQuestionMarkKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowShortcutsModal(true);
        trackEvent('shortcuts_opened', { source: 'keyboard-direct' });
        return;
      }

      if (textEditingNodeId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          stopTextEditing();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedNodeId) {
        if (isNodeLocked(selectedNodeId)) return;
        e.preventDefault();
        duplicateNode(selectedNodeId);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedNodeId) {
        if (e.shiftKey) {
          e.preventDefault();
          copyNodeStyles(selectedNodeId);
          return;
        }
        e.preventDefault();
        copyNode(selectedNodeId);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (e.shiftKey && selectedNodeId) {
          e.preventDefault();
          pasteNodeStyles(selectedNodeId);
          return;
        }
        e.preventDefault();
        if (!selectedNodeId) {
          pasteNode(null);
          return;
        }

        const selectedMeta = findNodeMeta(pageTree, selectedNodeId);
        if (!selectedMeta) {
          pasteNode(null);
          return;
        }

        pasteNode(selectedMeta.parentId, selectedMeta.index + 1);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        zoomIn();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      }

      if (e.key === 'Enter' && selectedNodeId) {
        if (isNodeLocked(selectedNodeId)) return;
        const node = getNode(selectedNodeId);
        if (node && INLINE_EDITABLE_TYPES.has(node.type)) {
          e.preventDefault();
          startTextEditing(selectedNodeId);
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        if (isNodeLocked(selectedNodeId)) return;
        e.preventDefault();

        if (selectedNodeIds.length > 1) {
          removeNodes(selectedNodeIds);
          return;
        }

        removeNode(selectedNodeId);
      }

      if (e.key === 'Escape' && selectedNodeId) {
        e.preventDefault();
        selectNode(null);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    selectedNodeId,
    selectedNodeIds,
    removeNode,
    removeNodes,
    duplicateNode,
    copyNode,
    pasteNode,
    copyNodeStyles,
    pasteNodeStyles,
    pageTree,
    zoomIn,
    zoomOut,
    resetZoom,
    getNode,
    isNodeLocked,
    textEditingNodeId,
    stopTextEditing,
    startTextEditing,
    selectNode,
  ]);

  // Restore any saved project when the app first mounts.
  useEffect(() => {
    const saved = loadProjectFromLocalStorage();
    if (saved) {
      loadProjectFile(saved);
      trackEvent('project_bootstrapped', { source: 'local-storage' });
    } else {
      // Load sample website if no saved project
      const sampleNodes = createSampleWebsite();
      const snapshot = createProjectSnapshot();
      snapshot.pages = sampleNodes;
      snapshot.name = 'Sample Website';
      loadProjectFile(snapshot);
      trackEvent('project_bootstrapped', { source: 'sample-project' });
    }
    didBootstrap.current = true;
  }, [loadProjectFile, createProjectSnapshot]);

  useEffect(() => {
    if (!showPreviewModal) return;
    trackEvent('preview_opened', { source: 'toolbar' });
  }, [showPreviewModal]);

  // Debounced autosave whenever project content changes.
  useEffect(() => {
    if (!didBootstrap.current) return;
    const timeout = setTimeout(() => {
      saveProjectToLocalStorage(createProjectSnapshot());
      markPersisted();
    }, 500);
    return () => clearTimeout(timeout);
  }, [pageTree, theme, projectName, createProjectSnapshot, markPersisted]);

  useEffect(() => {
    function handleGlobalPointerDown() {
      closeNodeContextMenu();
    }

    document.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => document.removeEventListener('pointerdown', handleGlobalPointerDown);
  }, [closeNodeContextMenu]);

  function handleDragStart(event: DragStartEvent) {
    clearDropIndicator();
    setDragGuides(null);
    setDragMetrics(null);

    const activator = event.activatorEvent as MouseEvent | PointerEvent | KeyboardEvent | undefined;
    if (activator && 'clientX' in activator && 'clientY' in activator) {
      dragStartPoint.current = { x: activator.clientX, y: activator.clientY };
    } else {
      dragStartPoint.current = null;
    }

    const id = event.active.id as string;
    if (id.startsWith('palette-')) {
      setActiveDragType(id.replace('palette-', ''));
      return;
    }

    if (id.startsWith('template-')) {
      const templateId = id.replace('template-', '');
      const template = loadTemplates().find((t) => t.id === templateId);
      setActiveDragType(template?.name ?? 'Template');
      return;
    }

    if (id.startsWith('asset-')) {
      const assetId = id.replace('asset-', '');
      const asset = loadAssets().find((item) => item.id === assetId);
      setActiveDragType(asset?.name ?? 'Image Asset');
      return;
    }

    setActiveDragType('Move');
  }

  function handleDragMove(event: DragMoveEvent) {
    const { active, over } = event;
    if (!over) {
      clearDropIndicator();
      setDragGuides(null);
      setDragMetrics(null);
      return;
    }

    const overId = over.id as string;
    const activeId = active.id as string;
    if (overId === 'canvas-root' || overId === activeId) {
      clearDropIndicator();
      setDragGuides(null);
      setDragMetrics(null);
      return;
    }

    const overNode = getNode(overId);
    if (!overNode) {
      clearDropIndicator();
      setDragGuides(null);
      setDragMetrics(null);
      return;
    }

    const activeNode = activeId.startsWith('palette-') || activeId.startsWith('template-') || activeId.startsWith('asset-') ? null : getNode(activeId);
    if (activeNode && containsNodeId(activeNode, overId)) {
      clearDropIndicator();
      setDragGuides(null);
      setDragMetrics(null);
      return;
    }

    const translatedRect = active.rect.current.translated;
    const pointerX = translatedRect
      ? translatedRect.left + translatedRect.width / 2
      : over.rect.left + over.rect.width / 2;
    const pointerY = translatedRect
      ? translatedRect.top + translatedRect.height / 2
      : over.rect.top + over.rect.height / 2;
    const position = getDropPosition(
      overNode.type,
      over.rect.left,
      over.rect.top,
      over.rect.width,
      over.rect.height,
      pointerX,
      pointerY
    );

    const centerX = over.rect.left + over.rect.width / 2;
    const centerY = over.rect.top + over.rect.height / 2;
    const left = over.rect.left;
    const right = over.rect.left + over.rect.width;
    const top = over.rect.top;
    const bottom = over.rect.top + over.rect.height;
    const snapThreshold = 10;

    const xLines = [left, centerX, right].filter((x) => Math.abs(pointerX - x) <= snapThreshold);
    const yLines = [top, centerY, bottom].filter((y) => Math.abs(pointerY - y) <= snapThreshold);
    setDragGuides(xLines.length || yLines.length ? { xLines, yLines } : null);

    const start = dragStartPoint.current;
    setDragMetrics({
      x: pointerX,
      y: pointerY,
      dx: start ? pointerX - start.x : 0,
      dy: start ? pointerY - start.y : 0,
    });

    setDropIndicator({ targetId: overId, position });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDragType(null);
    setDragGuides(null);
    setDragMetrics(null);
    dragStartPoint.current = null;
    clearDropIndicator();
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragType(null);
    setDragGuides(null);
    setDragMetrics(null);
    dragStartPoint.current = null;
    const { active, over } = event;
    const indicator = dropIndicator;
    clearDropIndicator();
    if (!over) return;

    const activeId = active.id as string;

    if (activeId.startsWith('palette-') || activeId.startsWith('template-') || activeId.startsWith('asset-')) {
      let nodeToInsert: Omit<EditorNode, 'id'> | null = null;

      if (activeId.startsWith('palette-')) {
        const type = activeId.replace('palette-', '');
        const def = componentDefinitions.find((c) => c.type === type);
        if (!def) return;
        nodeToInsert = {
          type: def.type,
          props: { ...def.defaultProps },
          styles: { ...def.defaultStyles },
          children: def.defaultChildren ?? [],
        };
      } else {
        if (activeId.startsWith('template-')) {
          const templateId = activeId.replace('template-', '');
          const template = loadTemplates().find((item) => item.id === templateId);
          if (!template) return;
          nodeToInsert = instantiateTemplateNode(template);
        } else {
          const assetId = activeId.replace('asset-', '');
          const asset = loadAssets().find((item) => item.id === assetId);
          if (!asset) return;
          nodeToInsert = {
            type: 'image',
            props: { src: asset.url, alt: asset.name, objectFit: 'cover' },
            styles: { width: '100%', borderRadius: '8px', display: 'block' },
            children: [],
          };
        }
      }

      const overId = over.id as string;
      if (overId === 'canvas-root') {
        addNode(nodeToInsert, null, pageTree.length);
        return;
      }

      const overNode = getNode(overId);
      const overMeta = findNodeMeta(pageTree, overId);
      if (!overNode || !overMeta) {
        addNode(nodeToInsert, null, pageTree.length);
        return;
      }

      const position = indicator?.targetId === overId ? indicator.position : 'inside';
      if (position === 'inside' && isContainerType(overNode.type)) {
        addNode(nodeToInsert, overId, overNode.children.length);
        return;
      }

      const insertIndex = position === 'before' ? overMeta.index : overMeta.index + 1;
      addNode(nodeToInsert, overMeta.parentId, insertIndex);
      return;
    }

    if (over.id === activeId) return;

    const overId = over.id as string;
    const activeNode = getNode(activeId);
    if (!activeNode) return;

    if (overId === 'canvas-root') {
      moveNode(activeId, null, pageTree.length);
      return;
    }

    const overNode = getNode(overId);
    if (!overNode) {
      moveNode(activeId, null, pageTree.length);
      return;
    }

    // Prevent dropping into own descendant branch.
    if (containsNodeId(activeNode, overId)) return;

    const overMeta = findNodeMeta(pageTree, overId);
    if (!overMeta) {
      moveNode(activeId, null, pageTree.length);
      return;
    }

    const position = indicator?.targetId === overId
      ? indicator.position
      : isContainerType(overNode.type)
      ? 'inside'
      : 'after';

    if (position === 'inside' && isContainerType(overNode.type)) {
      moveNode(activeId, overId, overNode.children.length);
      return;
    }

    const siblingIndex = position === 'before' ? overMeta.index : overMeta.index + 1;
    moveNode(activeId, overMeta.parentId, siblingIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
        <Toolbar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Loading editor...</div>}>
            <ResizableLayout
              onPreviewClick={() => setShowPreviewModal(true)}
              onCodePanelToggle={() => setShowCodePanel((v) => !v)}
              showCodePanel={showCodePanel}
            />
            <CodePanel isOpen={showCodePanel} onClose={() => setShowCodePanel(false)} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <BulkActionsToolbar />
        <KeyboardShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
        <PreviewModal isOpen={showPreviewModal} onClose={() => setShowPreviewModal(false)} />
      </Suspense>
      <ToastContainer />

      <DragOverlay>
        {activeDragType && (
          <div className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-semibold text-white opacity-90 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            {activeDragType}
          </div>
        )}
      </DragOverlay>

      {dragGuides &&
        dragGuides.xLines.map((x, index) => (
          <div
            key={`x-guide-${index}-${x}`}
            style={{
              position: 'fixed',
              top: 0,
              bottom: 0,
              left: `${x}px`,
              width: '1px',
              pointerEvents: 'none',
              zIndex: 280,
            }}
            className="bg-green-500/95 shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_0_10px_rgba(34,197,94,0.35)]"
          />
        ))}

      {dragGuides &&
        dragGuides.yLines.map((y, index) => (
          <div
            key={`y-guide-${index}-${y}`}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              top: `${y}px`,
              height: '1px',
              pointerEvents: 'none',
              zIndex: 280,
            }}
            className="bg-green-500/95 shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_0_10px_rgba(34,197,94,0.35)]"
          />
        ))}

      {dragMetrics && (
        <div
          style={{
            position: 'fixed',
            left: `${dragMetrics.x + 12}px`,
            top: `${dragMetrics.y + 12}px`,
            pointerEvents: 'none',
            zIndex: 285,
          }}
          className="whitespace-nowrap rounded-md border border-slate-700 bg-slate-950/90 px-2 py-1 text-[0.7rem] font-semibold text-slate-300"
        >
          dx: {Math.round(dragMetrics.dx)} | dy: {Math.round(dragMetrics.dy)}
        </div>
      )}
    </DndContext>
  );
}

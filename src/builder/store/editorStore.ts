import { create } from 'zustand';
import { nanoid } from '../utils/nanoid';
import type { Breakpoint, EditorNode, ProjectFile, ThemeConfig } from '../types';
import { defaultTheme } from '../themes';
import { trackEvent } from '../analytics';

export type DropPosition = 'before' | 'inside' | 'after';

export interface DropIndicator {
  targetId: string;
  position: DropPosition;
}

export interface NodeContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

// ─── History helpers ──────────────────────────────────────────────────────────

const MAX_HISTORY = 50;
const BREAKPOINT_KEYS = new Set(['desktop', 'tablet', 'mobile']);

function pushHistory(
  history: EditorNode[][],
  state: EditorNode[]
): EditorNode[][] {
  return [...history, structuredClone(state)].slice(-MAX_HISTORY);
}

// ─── Node helpers ─────────────────────────────────────────────────────────────

function findNode(
  nodes: EditorNode[],
  id: string
): EditorNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function collectNodeIds(node: EditorNode): string[] {
  return [node.id, ...node.children.flatMap((child) => collectNodeIds(child))];
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

function updateNodeInTree(
  nodes: EditorNode[],
  id: string,
  updater: (node: EditorNode) => EditorNode
): EditorNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) {
      const updated = updater(node);
      if (updated !== node) changed = true;
      return updated;
    }

    const nextChildren = updateNodeInTree(node.children, id, updater);
    if (nextChildren !== node.children) {
      changed = true;
      return { ...node, children: nextChildren };
    }

    return node;
  });

  return changed ? next : nodes;
}

function removeNodeFromTree(
  nodes: EditorNode[],
  id: string
): EditorNode[] {
  let changed = false;
  const next: EditorNode[] = [];

  for (const node of nodes) {
    if (node.id === id) {
      changed = true;
      continue;
    }

    const nextChildren = removeNodeFromTree(node.children, id);
    if (nextChildren !== node.children) {
      changed = true;
      next.push({ ...node, children: nextChildren });
    } else {
      next.push(node);
    }
  }

  return changed ? next : nodes;
}

function removeNodesFromTree(
  nodes: EditorNode[],
  idsToRemove: Set<string>
): EditorNode[] {
  let changed = false;
  const next: EditorNode[] = [];

  for (const node of nodes) {
    if (idsToRemove.has(node.id)) {
      changed = true;
      continue;
    }

    const nextChildren = removeNodesFromTree(node.children, idsToRemove);
    if (nextChildren !== node.children) {
      changed = true;
      next.push({ ...node, children: nextChildren });
    } else {
      next.push(node);
    }
  }

  return changed ? next : nodes;
}

function insertNodeIntoTree(
  nodes: EditorNode[],
  parentId: string | null,
  node: EditorNode,
  index?: number
): EditorNode[] {
  if (parentId === null) {
    const idx = index ?? nodes.length;
    const result = [...nodes];
    result.splice(idx, 0, node);
    return result;
  }

  let changed = false;
  const next = nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...n.children];
      const idx = index ?? children.length;
      children.splice(idx, 0, node);
      changed = true;
      return { ...n, children };
    }

    const nextChildren = insertNodeIntoTree(n.children, parentId, node, index);
    if (nextChildren !== n.children) {
      changed = true;
      return { ...n, children: nextChildren };
    }

    return n;
  });

  return changed ? next : nodes;
}

function patchBorderToThemeToken(border: string): string {
  const colorPattern = /(#[0-9a-fA-F]{3,8}|rgba?\([^\)]+\)|hsla?\([^\)]+\))/g;
  if (colorPattern.test(border)) {
    return border.replace(colorPattern, 'var(--sb-color-border)');
  }
  return border;
}

function retokenizeNodeStyles(styles: Record<string, unknown>, nodeType: string): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === 'object' && value !== null && BREAKPOINT_KEYS.has(key)) {
      next[key] = retokenizeNodeStyles(value as Record<string, unknown>, nodeType);
      continue;
    }

    if (typeof value !== 'string') {
      next[key] = value;
      continue;
    }

    if (value.includes('var(--sb-')) {
      next[key] = value;
      continue;
    }

    if (key === 'backgroundColor') {
      next[key] = nodeType === 'button' || nodeType === 'badge' ? 'var(--sb-color-primary)' : 'var(--sb-color-surface)';
      continue;
    }

    if (key === 'color') {
      next[key] = nodeType === 'button' || nodeType === 'badge' ? 'var(--sb-color-on-primary)' : 'var(--sb-color-text)';
      continue;
    }

    if (key === 'borderColor') {
      next[key] = 'var(--sb-color-border)';
      continue;
    }

    if (key === 'border') {
      next[key] = patchBorderToThemeToken(value);
      continue;
    }

    if (key === 'backgroundImage' && value.includes('gradient')) {
      next[key] = 'var(--sb-gradient-brand)';
      continue;
    }

    next[key] = value;
  }

  return next;
}

function retokenizeTree(nodes: EditorNode[]): EditorNode[] {
  return nodes.map((node) => ({
    ...node,
    styles: retokenizeNodeStyles(node.styles as Record<string, unknown>, node.type),
    children: retokenizeTree(node.children),
  }));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface EditorStore {
  // Project metadata
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  lastPersistedAt: string | null;

  // Selection
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  textEditingNodeId: string | null;
  nodeContextMenu: NodeContextMenu | null;
  dropIndicator: DropIndicator | null;

  // Tree
  pageTree: EditorNode[];
  hiddenNodeIds: string[];
  lockedNodeIds: string[];
  collapsedLayerIds: string[];

  // History
  undoStack: EditorNode[][];
  redoStack: EditorNode[][];

  // Responsive
  activeBreakpoint: Breakpoint;
  canvasZoom: number;

  // Theme
  theme: ThemeConfig;

  // Clipboard
  clipboardNode: EditorNode | null;
  styleClipboard: EditorNode['styles'] | null;

  // Actions — selection
  selectNode: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  clearSelection: () => void;
  hoverNode: (id: string | null) => void;
  startTextEditing: (id: string) => void;
  stopTextEditing: () => void;
  openNodeContextMenu: (menu: NodeContextMenu) => void;
  closeNodeContextMenu: () => void;
  setDropIndicator: (indicator: DropIndicator | null) => void;
  clearDropIndicator: () => void;
  toggleNodeHidden: (id: string) => void;
  toggleNodeLocked: (id: string) => void;
  toggleLayerCollapsed: (id: string) => void;
  isNodeHidden: (id: string) => boolean;
  isNodeLocked: (id: string) => boolean;
  isLayerCollapsed: (id: string) => boolean;

  // Actions — tree
  addNode: (node: Omit<EditorNode, 'id'>, parentId?: string | null, index?: number) => string;
  updateNode: (id: string, patch: Partial<Pick<EditorNode, 'props' | 'styles'>>) => void;
  updateNodeProps: (id: string, props: Record<string, unknown>) => void;
  updateNodeStyles: (id: string, styles: Record<string, unknown>) => void;
  updateNodesStyles: (ids: string[], styles: Record<string, unknown>) => void;
  clearNodeStyleOverride: (id: string, styleKey: string) => void;
  clearNodeBreakpointStyles: (id: string) => void;
  removeNode: (id: string) => void;
  removeNodes: (ids: string[]) => void;
  duplicateNode: (id: string) => void;
  moveNode: (id: string, newParentId: string | null, index: number) => void;
  copyNode: (id: string) => void;
  pasteNode: (targetParentId?: string | null, index?: number) => void;
  copyNodeStyles: (id: string) => void;
  pasteNodeStyles: (id: string) => void;

  // Actions — history
  undo: () => void;
  redo: () => void;
  snapshot: () => void;

  // Actions — breakpoint
  setBreakpoint: (bp: Breakpoint) => void;
  setCanvasZoom: (value: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Actions — theme
  setTheme: (theme: ThemeConfig) => void;
  applyThemeTokensToAllNodes: () => void;

  // Actions — project
  setProjectName: (name: string) => void;
  createProjectSnapshot: () => ProjectFile;
  loadProjectFile: (project: ProjectFile) => void;
  resetProject: () => void;
  markPersisted: () => void;

  // Getters
  getNode: (id: string) => EditorNode | null;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  projectId: nanoid(),
  projectName: 'Untitled Project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastPersistedAt: null,

  selectedNodeId: null,
  selectedNodeIds: [],
  hoveredNodeId: null,
  textEditingNodeId: null,
  nodeContextMenu: null,
  dropIndicator: null,
  pageTree: [],
  hiddenNodeIds: [],
  lockedNodeIds: [],
  collapsedLayerIds: [],
  undoStack: [],
  redoStack: [],
  activeBreakpoint: 'desktop',
  canvasZoom: 1,
  theme: defaultTheme,
  clipboardNode: null,
  styleClipboard: null,

  selectNode: (id) =>
    set((s) => ({
      selectedNodeId: id,
      selectedNodeIds: id ? [id] : [],
      textEditingNodeId:
        s.textEditingNodeId && s.textEditingNodeId !== id ? null : s.textEditingNodeId,
      nodeContextMenu: null,
    })),
  toggleNodeSelection: (id) =>
    set((s) => {
      const isSelected = s.selectedNodeIds.includes(id);
      const nextSelected = isSelected
        ? s.selectedNodeIds.filter((nodeId) => nodeId !== id)
        : [...s.selectedNodeIds, id];

      return {
        selectedNodeIds: nextSelected,
        selectedNodeId: nextSelected.length > 0 ? nextSelected[nextSelected.length - 1] : null,
        textEditingNodeId:
          s.textEditingNodeId && !nextSelected.includes(s.textEditingNodeId)
            ? null
            : s.textEditingNodeId,
        nodeContextMenu: null,
      };
    }),
  setSelectedNodeIds: (ids) =>
    set({
      selectedNodeIds: ids,
      selectedNodeId: ids.length > 0 ? ids[ids.length - 1] : null,
      textEditingNodeId: null,
      nodeContextMenu: null,
    }),
  clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [], textEditingNodeId: null }),
  hoverNode: (id) => set({ hoveredNodeId: id }),
  startTextEditing: (id) => {
    if (get().isNodeLocked(id)) return;
    set({ textEditingNodeId: id, selectedNodeId: id });
  },
  stopTextEditing: () => set({ textEditingNodeId: null }),
  openNodeContextMenu: (menu) =>
    set({ nodeContextMenu: menu, selectedNodeId: menu.nodeId, textEditingNodeId: null }),
  closeNodeContextMenu: () => set({ nodeContextMenu: null }),
  setDropIndicator: (indicator) => set({ dropIndicator: indicator }),
  clearDropIndicator: () => set({ dropIndicator: null }),
  toggleNodeHidden: (id) =>
    set((s) => {
      const isHidden = s.hiddenNodeIds.includes(id);
      return {
        hiddenNodeIds: isHidden
          ? s.hiddenNodeIds.filter((nodeId) => nodeId !== id)
          : [...s.hiddenNodeIds, id],
        selectedNodeId: isHidden || s.selectedNodeId !== id ? s.selectedNodeId : null,
        selectedNodeIds:
          isHidden || !s.selectedNodeIds.includes(id)
            ? s.selectedNodeIds
            : s.selectedNodeIds.filter((nodeId) => nodeId !== id),
        textEditingNodeId: isHidden || s.textEditingNodeId !== id ? s.textEditingNodeId : null,
      };
    }),
  toggleNodeLocked: (id) =>
    set((s) => ({
      lockedNodeIds: s.lockedNodeIds.includes(id)
        ? s.lockedNodeIds.filter((nodeId) => nodeId !== id)
        : [...s.lockedNodeIds, id],
      textEditingNodeId: s.textEditingNodeId === id ? null : s.textEditingNodeId,
    })),
  toggleLayerCollapsed: (id) =>
    set((s) => ({
      collapsedLayerIds: s.collapsedLayerIds.includes(id)
        ? s.collapsedLayerIds.filter((nodeId) => nodeId !== id)
        : [...s.collapsedLayerIds, id],
    })),
  isNodeHidden: (id) => get().hiddenNodeIds.includes(id),
  isNodeLocked: (id) => get().lockedNodeIds.includes(id),
  isLayerCollapsed: (id) => get().collapsedLayerIds.includes(id),

  snapshot: () => {
    const { pageTree, undoStack } = get();
    set({
      undoStack: pushHistory(undoStack, pageTree),
      redoStack: [],
      updatedAt: new Date().toISOString(),
    });
  },

  addNode: (nodeDef, parentId = null, index) => {
    const id = nanoid();
    const node: EditorNode = { ...nodeDef, id, children: nodeDef.children ?? [] };
    get().snapshot();
    set((s) => ({ pageTree: insertNodeIntoTree(s.pageTree, parentId, node, index) }));
    trackEvent('node_added', {
      nodeType: node.type,
      parentId,
      index: index ?? null,
    });
    return id;
  },

  updateNode: (id, patch) => {
    get().snapshot();
    set((s) => ({
      pageTree: updateNodeInTree(s.pageTree, id, (n) => ({
        ...n,
        props: patch.props ? { ...n.props, ...patch.props } : n.props,
        styles: patch.styles ? { ...n.styles, ...patch.styles } : n.styles,
      })),
    }));
  },

  updateNodeProps: (id, props) => {
    get().snapshot();
    set((s) => ({
      pageTree: updateNodeInTree(s.pageTree, id, (n) => ({
        ...n,
        props: { ...n.props, ...props },
      })),
    }));
  },

  updateNodeStyles: (id, styles) => {
    const activeBreakpoint = get().activeBreakpoint;
    get().snapshot();
    set((s) => ({
      pageTree: updateNodeInTree(s.pageTree, id, (n) => ({
        ...n,
        styles: {
          ...n.styles,
          [activeBreakpoint]: {
            ...((n.styles[activeBreakpoint] as Record<string, unknown>) ?? {}),
            ...styles,
          },
        },
      })),
    }));
  },

  updateNodesStyles: (ids, styles) => {
    if (!ids.length) return;
    const activeBreakpoint = get().activeBreakpoint;
    get().snapshot();
    set((s) => ({
      pageTree: ids.reduce(
        (tree, id) => updateNodeInTree(tree, id, (n) => ({
          ...n,
          styles: {
            ...n.styles,
            [activeBreakpoint]: {
              ...((n.styles[activeBreakpoint] as Record<string, unknown>) ?? {}),
              ...styles,
            },
          },
        })),
        s.pageTree
      ),
    }));
  },

  clearNodeStyleOverride: (id, styleKey) => {
    const activeBreakpoint = get().activeBreakpoint;
    get().snapshot();
    set((s) => ({
      pageTree: updateNodeInTree(s.pageTree, id, (n) => {
        const currentOverrides =
          ((n.styles[activeBreakpoint] as Record<string, unknown>) ?? {});
        const { [styleKey]: _removed, ...rest } = currentOverrides;
        const nextStyles = { ...n.styles } as Record<string, unknown>;

        if (Object.keys(rest).length > 0) {
          nextStyles[activeBreakpoint] = rest;
        } else {
          delete nextStyles[activeBreakpoint];
        }

        return {
          ...n,
          styles: nextStyles as EditorNode['styles'],
        };
      }),
    }));
  },

  clearNodeBreakpointStyles: (id) => {
    const activeBreakpoint = get().activeBreakpoint;
    get().snapshot();
    set((s) => ({
      pageTree: updateNodeInTree(s.pageTree, id, (n) => {
        const nextStyles = { ...n.styles } as Record<string, unknown>;
        delete nextStyles[activeBreakpoint];

        return {
          ...n,
          styles: nextStyles as EditorNode['styles'],
        };
      }),
    }));
  },

  removeNode: (id) => {
    const node = findNode(get().pageTree, id);
    const subtreeIds = node ? new Set(collectNodeIds(node)) : new Set([id]);
    get().snapshot();
    set((s) => ({
      pageTree: removeNodeFromTree(s.pageTree, id),
      hiddenNodeIds: s.hiddenNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      lockedNodeIds: s.lockedNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      collapsedLayerIds: s.collapsedLayerIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      selectedNodeId: s.selectedNodeId && subtreeIds.has(s.selectedNodeId) ? null : s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      textEditingNodeId:
        s.textEditingNodeId && subtreeIds.has(s.textEditingNodeId) ? null : s.textEditingNodeId,
    }));
    trackEvent('node_removed', {
      nodeId: id,
      nodeType: node?.type ?? 'unknown',
      subtreeSize: subtreeIds.size,
    });
  },

  removeNodes: (ids) => {
    if (!ids.length) return;

    const uniqueIds = [...new Set(ids)];
    const pageTree = get().pageTree;
    const subtreeIds = new Set<string>();

    for (const id of uniqueIds) {
      const node = findNode(pageTree, id);
      if (!node) continue;
      for (const childId of collectNodeIds(node)) {
        subtreeIds.add(childId);
      }
    }

    if (!subtreeIds.size) return;

    get().snapshot();
    set((s) => ({
      pageTree: removeNodesFromTree(s.pageTree, subtreeIds),
      hiddenNodeIds: s.hiddenNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      lockedNodeIds: s.lockedNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      collapsedLayerIds: s.collapsedLayerIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      selectedNodeId: s.selectedNodeId && subtreeIds.has(s.selectedNodeId) ? null : s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds.filter((nodeId) => !subtreeIds.has(nodeId)),
      textEditingNodeId:
        s.textEditingNodeId && subtreeIds.has(s.textEditingNodeId) ? null : s.textEditingNodeId,
    }));
  },

  duplicateNode: (id) => {
    const { pageTree } = get();
    const original = findNode(pageTree, id);
    if (!original) return;

    function cloneWithNewIds(node: EditorNode): EditorNode {
      return {
        ...node,
        id: nanoid(),
        children: node.children.map(cloneWithNewIds),
      };
    }

    const cloned = cloneWithNewIds(original);
    get().snapshot();

    // Insert after sibling
    function insertAfter(nodes: EditorNode[]): EditorNode[] {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx !== -1) {
        const result = [...nodes];
        result.splice(idx + 1, 0, cloned);
        return result;
      }
      return nodes.map((n) => ({ ...n, children: insertAfter(n.children) }));
    }

    set((s) => ({ pageTree: insertAfter(s.pageTree) }));
    trackEvent('node_duplicated', {
      sourceNodeId: id,
      nodeType: original.type,
    });
  },

  moveNode: (id, newParentId, index) => {
    const node = findNode(get().pageTree, id);
    if (!node) return;
    get().snapshot();
    set((s) => {
      const sourceMeta = findNodeMeta(s.pageTree, id);
      const without = removeNodeFromTree(s.pageTree, id);

      let targetIndex = index;
      if (sourceMeta && sourceMeta.parentId === newParentId && sourceMeta.index < index) {
        targetIndex = index - 1;
      }

      return { pageTree: insertNodeIntoTree(without, newParentId, node, targetIndex) };
    });
    trackEvent('node_moved', {
      nodeId: id,
      nodeType: node.type,
      newParentId,
      index,
    });
  },

  copyNode: (id) => {
    const node = findNode(get().pageTree, id);
    if (!node) return;
    set({ clipboardNode: structuredClone(node) });
  },

  pasteNode: (targetParentId = null, index) => {
    const { clipboardNode, selectedNodeId, pageTree } = get();
    if (!clipboardNode) return;

    function cloneWithNewIds(node: EditorNode): EditorNode {
      return {
        ...node,
        id: nanoid(),
        children: node.children.map(cloneWithNewIds),
      };
    }

    const cloned = cloneWithNewIds(clipboardNode);
    const parentId = targetParentId ?? null;
    const resolvedIndex =
      typeof index === 'number'
        ? index
        : parentId === null
        ? pageTree.length
        : (() => {
            const parent = findNode(pageTree, parentId);
            return parent ? parent.children.length : pageTree.length;
          })();

    get().snapshot();
    set((s) => ({
      pageTree: insertNodeIntoTree(s.pageTree, parentId, cloned, resolvedIndex),
      selectedNodeId: cloned.id,
    }));

    if (selectedNodeId === null && parentId !== null) {
      set({ selectedNodeId: cloned.id });
    }
  },

  copyNodeStyles: (id) => {
    const node = findNode(get().pageTree, id);
    if (!node) return;
    set({ styleClipboard: structuredClone(node.styles) });
  },

  pasteNodeStyles: (id) => {
    const { styleClipboard, selectedNodeIds } = get();
    if (!styleClipboard) return;
    const targets = selectedNodeIds.includes(id) && selectedNodeIds.length > 1
      ? [...selectedNodeIds]
      : [id];
    get().snapshot();
    set((s) => ({
      pageTree: targets.reduce(
        (tree, targetId) => updateNodeInTree(tree, targetId, (n) => ({
          ...n,
          styles: structuredClone(styleClipboard),
        })),
        s.pageTree
      ),
    }));
  },

  undo: () => {
    const { undoStack, pageTree } = get();
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    set((s) => ({
      pageTree: prev,
      undoStack: s.undoStack.slice(0, -1),
      redoStack: pushHistory(s.redoStack, pageTree),
    }));
  },

  redo: () => {
    const { redoStack, pageTree } = get();
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    set((s) => ({
      pageTree: next,
      redoStack: s.redoStack.slice(0, -1),
      undoStack: pushHistory(s.undoStack, pageTree),
    }));
  },

  setBreakpoint: (bp) => set({ activeBreakpoint: bp }),

  setCanvasZoom: (value) =>
    set({
      canvasZoom: Math.max(0.5, Math.min(2, Number.isFinite(value) ? value : 1)),
    }),

  zoomIn: () =>
    set((s) => ({
      canvasZoom: Math.min(2, Math.round((s.canvasZoom + 0.1) * 100) / 100),
    })),

  zoomOut: () =>
    set((s) => ({
      canvasZoom: Math.max(0.5, Math.round((s.canvasZoom - 0.1) * 100) / 100),
    })),

  resetZoom: () => set({ canvasZoom: 1 }),

  setTheme: (theme) => {
    set({ theme, updatedAt: new Date().toISOString() });
    trackEvent('theme_changed', {
      themeName: theme.name,
      familyId: theme.familyId ?? null,
      mode: theme.mode ?? null,
    });
  },

  applyThemeTokensToAllNodes: () =>
    set((s) => ({
      pageTree: retokenizeTree(s.pageTree),
      undoStack: pushHistory(s.undoStack, s.pageTree),
      redoStack: [],
      updatedAt: new Date().toISOString(),
    })),

  setProjectName: (name) =>
    set({
      projectName: name.trim() || 'Untitled Project',
      updatedAt: new Date().toISOString(),
    }),

  createProjectSnapshot: () => {
    const { projectId, projectName, createdAt, theme, pageTree } = get();
    return {
      id: projectId,
      name: projectName,
      createdAt,
      updatedAt: new Date().toISOString(),
      theme,
      pages: structuredClone(pageTree),
    };
  },

  loadProjectFile: (project) =>
    {
      set({
        projectId: project.id,
        projectName: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        theme: project.theme,
        pageTree: project.pages,
        selectedNodeId: null,
        selectedNodeIds: [],
        hoveredNodeId: null,
        textEditingNodeId: null,
        nodeContextMenu: null,
        hiddenNodeIds: [],
        lockedNodeIds: [],
        collapsedLayerIds: [],
        undoStack: [],
        redoStack: [],
        lastPersistedAt: project.updatedAt,
        canvasZoom: 1,
      });
      trackEvent('project_loaded', {
        source: 'loadProjectFile',
        projectName: project.name,
        nodeCount: project.pages.length,
      });
    },

  resetProject: () =>
    {
      set({
        projectId: nanoid(),
        projectName: 'Untitled Project',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pageTree: [],
        theme: defaultTheme,
        selectedNodeId: null,
        selectedNodeIds: [],
        hoveredNodeId: null,
        textEditingNodeId: null,
        nodeContextMenu: null,
        hiddenNodeIds: [],
        lockedNodeIds: [],
        collapsedLayerIds: [],
        undoStack: [],
        redoStack: [],
        lastPersistedAt: null,
        canvasZoom: 1,
      });
      trackEvent('project_reset');
    },

  markPersisted: () => set({ lastPersistedAt: new Date().toISOString() }),

  getNode: (id) => findNode(get().pageTree, id),
}));

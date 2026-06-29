import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { compactInputClass, iconBtnEnabled, iconBtnDisabled, microInputClass } from '../styles/uiClasses';
import { componentsByCategory } from '../components/registry';
import { allIconNames, Icon } from '../components/Icon';
import { CollapsibleSection } from '../components/CollapsibleSection';
import type { ComponentDefinition, EditorNode } from '../types';
import { useEditorStore } from '../store/editorStore';
import { toast } from '../components/Toast';
import {
  TEMPLATE_EVENT,
  instantiateTemplateNode,
  loadTemplates,
  moveTemplate,
  renameTemplate,
  removeTemplate,
  type SavedTemplate,
} from '../utils/templates';
import {
  ASSET_EVENT,
  addAsset,
  loadAssets,
  moveAsset,
  removeAsset,
  type AssetItem,
} from '../utils/assets';

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

function getChildrenForParent(nodes: EditorNode[], parentId: string | null): EditorNode[] {
  if (parentId === null) return nodes;

  function findById(tree: EditorNode[], id: string): EditorNode | null {
    for (const node of tree) {
      if (node.id === id) return node;
      const found = findById(node.children, id);
      if (found) return found;
    }
    return null;
  }

  const parent = findById(nodes, parentId);
  return parent ? parent.children : [];
}

function DraggablePaletteItem({ def, isFavorite, onToggleFavorite, onUse }: { def: ComponentDefinition; isFavorite?: boolean; onToggleFavorite?: () => void; onUse?: () => void }) {
  const addNode = useEditorStore((s) => s.addNode);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${def.type}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title="Drag onto canvas or double-click to add"
      onDoubleClick={() => {
        addNode({
          type: def.type,
          props: { ...def.defaultProps },
          styles: { ...def.defaultStyles },
          children: def.defaultChildren ?? [],
        });
        onUse?.();
      }}
      className={`flex cursor-grab select-none items-center gap-2 rounded-md py-2 text-[0.8125rem] transition-all duration-150 ${isDragging ? 'scale-[0.985] bg-indigo-900 text-indigo-300 opacity-50' : 'text-slate-300 hover:bg-slate-800'}`}
    >
      <span className="w-5 text-center text-base">{def.icon}</span>
      <span className="flex-1">{def.label}</span>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className={`cursor-pointer border-0 bg-none px-0.5 text-sm leading-none ${isFavorite ? 'text-amber-500' : 'text-slate-600'}`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      )}
    </div>
  );
}

function DraggableTemplateItem({
  template,
  onInsert,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onStartRename,
  onRemove,
}: {
  template: SavedTemplate;
  onInsert: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isRenaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onStartRename: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onInsert}
      title="Drag onto canvas or double-click to add"
      className={`flex cursor-grab select-none items-center gap-1.5 py-1.5 transition-all duration-150 ${isDragging ? 'scale-[0.985] bg-sky-950 opacity-55' : 'hover:bg-slate-800'}`}
    >
      <span className="w-4 text-center text-cyan-400">⧉</span>
      {isRenaming ? (
        <input
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onRenameCommit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onRenameCancel();
            }
          }}
          autoFocus
          className={`${microInputClass} min-w-0 flex-1 bg-slate-950 text-xs text-slate-200`}
        />
      ) : (
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-300">
          {template.name}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        disabled={!canMoveUp}
        className={`h-6 w-5 ${canMoveUp ? iconBtnEnabled : iconBtnDisabled}`}
        title="Move template up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        disabled={!canMoveDown}
        className={`h-6 w-5 ${canMoveDown ? iconBtnEnabled : iconBtnDisabled}`}
        title="Move template down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isRenaming) {
            onRenameCommit();
            return;
          }
          onStartRename();
        }}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-slate-800 bg-slate-950 text-xs text-blue-300"
        title={isRenaming ? 'Save name' : 'Rename template'}
      >
        {isRenaming ? '✓' : '✎'}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-red-950 bg-red-950/30 text-xs text-red-300"
        title="Remove template"
      >
        ×
      </button>
    </div>
  );
}

function DraggableAssetItem({
  asset,
  onInsert,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  asset: AssetItem;
  onInsert: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onDoubleClick={onInsert}
      title="Drag onto canvas or double-click to add"
      className={`flex cursor-grab select-none items-center gap-1.5 py-1 transition-all duration-150 ${isDragging ? 'scale-[0.985] bg-sky-950 opacity-60' : 'hover:bg-slate-800'}`}
    >
      <img src={asset.url} alt={asset.name} className="h-[26px] w-[26px] shrink-0 rounded border border-slate-800 object-cover" />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
        className="flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-slate-800 bg-slate-950 px-[7px] py-[5px] text-left text-[0.72rem] text-slate-300"
        title="Insert image"
      >
        {asset.name}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp();
        }}
        disabled={!canMoveUp}
        className={`h-6 w-5 ${canMoveUp ? iconBtnEnabled : iconBtnDisabled}`}
        title="Move asset up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown();
        }}
        disabled={!canMoveDown}
        className={`h-6 w-5 ${canMoveDown ? iconBtnEnabled : iconBtnDisabled}`}
        title="Move asset down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-red-950 bg-red-950/30 text-xs text-red-300"
        title="Remove asset"
      >
        ×
      </button>
    </div>
  );
}

function AssetGallery({
  assets,
  onInsert,
  onMove,
  onRemove,
}: {
  assets: AssetItem[];
  onInsert: (asset: AssetItem) => void;
  onMove: (assetId: string, direction: 'up' | 'down') => void;
  onRemove: (assetId: string) => void;
}) {

  return (
    <div className="space-y-1.5">
      {assets.slice(0, 20).map((asset) => {
        const orderIndex = assets.findIndex((item) => item.id === asset.id);
        const canMoveUp = orderIndex > 0;
        const canMoveDown = orderIndex >= 0 && orderIndex < assets.length - 1;

        return (
          <DraggableAssetItem
            key={asset.id}
            asset={asset}
            onInsert={() => onInsert(asset)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => onMove(asset.id, 'up')}
            onMoveDown={() => onMove(asset.id, 'down')}
            onRemove={() => onRemove(asset.id)}
          />
        );
      })}

      {assets.length > 20 && (
        <div className="px-1 pt-1 text-[0.68rem] text-slate-600">
          Showing 20 of {assets.length} assets
        </div>
      )}
      {assets.length === 0 && (
        <div className="px-1 pb-1 text-xs text-slate-600">No assets yet</div>
      )}
      </div>
    
  );
}

export function Sidebar() {
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('component-favorites') ?? '[]'); } catch { return []; }
  });
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('component-recent') ?? '[]'); } catch { return []; }
  });
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadTemplates());
  const [assets, setAssets] = useState<AssetItem[]>(() => loadAssets());
  const [templateSearch, setTemplateSearch] = useState('');
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const trackRecentlyUsed = (type: string) => {
    setRecentlyUsed((prev) => {
      const next = [type, ...prev.filter((t) => t !== type)].slice(0, 5);
      localStorage.setItem('component-recent', JSON.stringify(next));
      return next;
    });
  };

  const toggleFavorite = (type: string) => {
    setFavorites((prev) => {
      const next = prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type];
      localStorage.setItem('component-favorites', JSON.stringify(next));
      return next;
    });
  };

  const {
    pageTree,
    hiddenNodeIds,
    selectedNodeIds,
    addNode,
    selectNode,
    toggleNodeSelection,
    moveNode,
    toggleNodeHidden,
    toggleNodeLocked,
    toggleLayerCollapsed,
    isNodeLocked,
    isLayerCollapsed,
  } = useEditorStore();

  useEffect(() => {
    function refreshTemplates() {
      setTemplates(loadTemplates());
    }

    function refreshAssets() {
      setAssets(loadAssets());
    }

    window.addEventListener(TEMPLATE_EVENT, refreshTemplates);
    window.addEventListener(ASSET_EVENT, refreshAssets);
    return () => {
      window.removeEventListener(TEMPLATE_EVENT, refreshTemplates);
      window.removeEventListener(ASSET_EVENT, refreshAssets);
    };
  }, []);

  const selectedNodeId = selectedNodeIds[selectedNodeIds.length - 1] ?? null;

  function getInsertTarget(): { parentId: string | null; index: number | undefined } {
    if (!selectedNodeId) return { parentId: null, index: undefined };
    const meta = findNodeMeta(pageTree, selectedNodeId);
    if (!meta) return { parentId: null, index: undefined };
    return { parentId: meta.parentId, index: meta.index + 1 };
  }

  function insertTemplate(template: SavedTemplate) {
    const target = getInsertTarget();
    addNode(instantiateTemplateNode(template), target.parentId, target.index);
    toast('Template inserted');
  }

  function insertAssetImage(asset: AssetItem) {
    const target = getInsertTarget();
    addNode(
      {
        type: 'image',
        props: { src: asset.url, alt: asset.name, objectFit: 'cover' },
        styles: { width: '100%', borderRadius: '8px', display: 'block' },
        children: [],
      },
      target.parentId,
      target.index
    );
    toast('Image inserted');
  }

  function insertSvgIcon(iconName: string) {
    const target = getInsertTarget();
    addNode(
      {
        type: 'icon',
        props: { iconName, size: 26, strokeWidth: 2, ariaLabel: iconName },
        styles: { display: 'inline-flex', color: 'var(--sb-color-primary)' },
        children: [],
      },
      target.parentId,
      target.index
    );
    toast(`${iconName} icon inserted`);
  }

  function handleUploadAsset(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const created = addAsset(file.name, String(reader.result ?? ''));
      if (!created) {
        toast('Could not save asset. Storage may be unavailable.', 'error');
        return;
      }
      setAssets(loadAssets());
      toast('Asset uploaded');
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveAsset(assetId: string) {
    const removed = removeAsset(assetId);
    if (!removed) {
      toast('Could not remove asset.', 'error');
      return;
    }
    setAssets(loadAssets());
    toast('Asset removed', 'info');
  }

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(templateSearch.trim().toLowerCase())
  );

  function renderLayerNode(node: EditorNode, depth: number): ReactNode {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHidden = hiddenNodeIds.includes(node.id);
    const isLocked = isNodeLocked(node.id);
    const collapsed = isLayerCollapsed(node.id);
    const hasChildren = node.children.length > 0;
    const meta = findNodeMeta(pageTree, node.id);
    const siblings = meta ? getChildrenForParent(pageTree, meta.parentId) : [];
    const canMoveUp = !!meta && meta.index > 0 && !isLocked;
    const canMoveDown = !!meta && meta.index < siblings.length - 1 && !isLocked;
    const canMoveTop = canMoveUp;
    const canMoveBottom = canMoveDown;
    return (
      <div key={node.id}>
        <div
          className={`flex w-full items-center gap-1.5 px-2 py-1 ${isSelected ? 'bg-slate-800' : 'bg-transparent'} ${isHidden ? 'opacity-55' : 'opacity-100'}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <button
            type="button"
            onClick={() => {
              if (hasChildren) toggleLayerCollapsed(node.id);
            }}
            disabled={!hasChildren}
            className={layerMiniBtnClass(hasChildren)}
            title={hasChildren ? (collapsed ? 'Expand children' : 'Collapse children') : 'No children'}
          >
            {hasChildren && <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={14} strokeWidth={1.75} />}
            {!hasChildren && <span className="opacity-30">−</span>}
          </button>

          <button
            type="button"
            onClick={(e) => {
              if (e.shiftKey || e.ctrlKey || e.metaKey) {
                toggleNodeSelection(node.id);
                return;
              }
              selectNode(node.id);
            }}
            className={`min-w-0 flex-1 overflow-hidden border-none bg-transparent py-0.5 text-left text-xs text-ellipsis whitespace-nowrap ${isSelected ? 'text-indigo-300' : 'text-slate-400'} cursor-pointer`}
            title={node.type}
          >
            {node.type}
          </button>

          <button
            type="button"
            onClick={() => toggleNodeLocked(node.id)}
            className={layerMiniBtnClass(true)}
            title={isLocked ? 'Unlock node' : 'Lock node'}
          >
            <Icon name={isLocked ? 'unlock' : 'lock'} size={14} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!meta || !canMoveUp) return;
              moveNode(node.id, meta.parentId, meta.index - 1);
            }}
            className={layerMiniBtnClass(canMoveUp)}
            title="Move up"
            disabled={!canMoveUp}
          >
            <Icon name="chevron-up" size={14} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!meta || !canMoveDown) return;
              moveNode(node.id, meta.parentId, meta.index + 2);
            }}
            className={layerMiniBtnClass(canMoveDown)}
            title="Move down"
            disabled={!canMoveDown}
          >
            <Icon name="chevron-down" size={14} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!meta || !canMoveTop) return;
              moveNode(node.id, meta.parentId, 0);
            }}
            className={layerMiniBtnClass(canMoveTop)}
            title="Bring to top"
            disabled={!canMoveTop}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 11 12 6 7 11"></polyline>
              <polyline points="17 18 12 13 7 18"></polyline>
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!meta || !canMoveBottom) return;
              moveNode(node.id, meta.parentId, siblings.length);
            }}
            className={layerMiniBtnClass(canMoveBottom)}
            title="Send to bottom"
            disabled={!canMoveBottom}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 13 12 18 7 13"></polyline>
              <polyline points="17 6 12 11 7 6"></polyline>
            </svg>
          </button>

          <button
            type="button"
            onClick={() => toggleNodeHidden(node.id)}
            className={layerMiniBtnClass(true)}
            title={isHidden ? 'Show node' : 'Hide node'}
          >
            <Icon name={isHidden ? 'eye-off' : 'eye'} size={14} strokeWidth={1.75} />
          </button>
        </div>

        {!collapsed && node.children.map((child) => renderLayerNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="left-sidebar flex h-full min-h-0 w-full shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-3.5 pb-2.5 pt-3.5 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-600">
        Components
      </div>

      <div className="border-b border-slate-800 px-3.5 py-2">
        <input
          type="text"
          placeholder="Search components..."
          aria-label="Search components"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${compactInputClass} box-border`}
        />
      </div>

      <div className="px-3.5 py-2">
        <CollapsibleSection title="Templates" defaultOpen={true} contentClassName="pb-3">
          <div className="pb-1.5">
            <input
              type="text"
              placeholder="Search templates..."
              aria-label="Search templates"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className={`${compactInputClass} box-border bg-slate-950 text-xs text-slate-200`}
            />
          </div>
          {filteredTemplates.map((template) => (
            (() => {
              const orderIndex = templates.findIndex((item) => item.id === template.id);
              const canMoveUp = orderIndex > 0;
              const canMoveDown = orderIndex >= 0 && orderIndex < templates.length - 1;

              return (
                <DraggableTemplateItem
                  key={template.id}
                  template={template}
                  onInsert={() => insertTemplate(template)}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  onMoveUp={() => {
                    if (!moveTemplate(template.id, 'up')) {
                      toast('Could not reorder template.', 'error');
                      return;
                    }
                    setTemplates(loadTemplates());
                  }}
                  onMoveDown={() => {
                    if (!moveTemplate(template.id, 'down')) {
                      toast('Could not reorder template.', 'error');
                      return;
                    }
                    setTemplates(loadTemplates());
                  }}
                  isRenaming={renamingTemplateId === template.id}
                  renameValue={renamingTemplateId === template.id ? renameValue : template.name}
                  onRenameChange={setRenameValue}
                  onRenameCommit={() => {
                    if (renamingTemplateId !== template.id) return;
                    const renamed = renameTemplate(template.id, renameValue);
                    if (!renamed) {
                      toast('Could not rename template.', 'error');
                      return;
                    }
                    setRenamingTemplateId(null);
                    setRenameValue('');
                    setTemplates(loadTemplates());
                    toast('Template renamed');
                  }}
                  onRenameCancel={() => {
                    setRenamingTemplateId(null);
                    setRenameValue('');
                  }}
                  onStartRename={() => {
                    setRenamingTemplateId(template.id);
                    setRenameValue(template.name);
                  }}
                  onRemove={() => {
                    if (!removeTemplate(template.id)) {
                      toast('Could not remove template.', 'error');
                      return;
                    }
                    setTemplates(loadTemplates());
                    toast('Template removed', 'info');
                  }}
                />
              );
            })()
          ))}
          {filteredTemplates.length === 0 && (
            <div className="px-1 pb-1 text-xs text-slate-600">No templates match</div>
          )}
        </CollapsibleSection>

        {search.trim() ? (
          // Flat filtered list
          (() => {
            const q = search.trim().toLowerCase();
            const all = Object.values(componentsByCategory).flat().filter(
              (d) => d.label.toLowerCase().includes(q) || d.type.toLowerCase().includes(q)
            );
            if (all.length === 0) {
              return <div className="px-4 py-3 text-[0.8125rem] text-slate-600">No results</div>;
            }
            return all.map((def) => <DraggablePaletteItem key={def.type} def={def} isFavorite={favorites.includes(def.type)} onToggleFavorite={() => toggleFavorite(def.type)} onUse={() => trackRecentlyUsed(def.type)} />);
          })()
        ) : (
          <>
              <CollapsibleSection title="Assets" defaultOpen={true} contentClassName="pb-3">
              <div className="pb-2">
                <label className="block w-full">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadAsset(file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <span className="block cursor-pointer rounded-md border border-dashed border-blue-700 bg-blue-950/40 px-2 py-1.5 text-center text-xs text-blue-300">
                    Upload Image
                  </span>
                </label>
              </div>
              <AssetGallery
                assets={assets}
                onInsert={insertAssetImage}
                onMove={(assetId, direction) => {
                  if (!moveAsset(assetId, direction)) {
                    toast('Could not reorder asset.', 'error');
                    return;
                  }
                  setAssets(loadAssets());
                }}
                onRemove={handleRemoveAsset}
              />
            </CollapsibleSection>

            <CollapsibleSection title="SVG Icons" defaultOpen={false} contentClassName="pb-3">
              <p className="pb-2 text-xs text-slate-500">Insert Heroicons as editable SVG blocks.</p>
              <div className="grid grid-cols-2 gap-1.5">
                {allIconNames.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => insertSvgIcon(iconName)}
                    aria-label={`Insert ${iconName} icon`}
                    className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-left text-[0.7rem] text-slate-300"
                    title={`Insert ${iconName}`}
                  >
                    <Icon name={iconName} size={14} />
                    <span className="truncate">{iconName}</span>
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            {recentlyUsed.length > 0 && (
              <CollapsibleSection title="Recently Used" defaultOpen={true} contentClassName="pb-3">
                {Object.values(componentsByCategory).flat()
                  .filter((d) => recentlyUsed.includes(d.type))
                  .sort((a, b) => recentlyUsed.indexOf(a.type) - recentlyUsed.indexOf(b.type))
                  .map((def) => (
                    <DraggablePaletteItem key={`recent-${def.type}`} def={def} isFavorite={favorites.includes(def.type)} onToggleFavorite={() => toggleFavorite(def.type)} onUse={() => trackRecentlyUsed(def.type)} />
                  ))}
              </CollapsibleSection>
            )}
            {favorites.length > 0 && (
              <CollapsibleSection title="Favorites" defaultOpen={true} contentClassName="pb-3">
                {Object.values(componentsByCategory).flat()
                  .filter((d) => favorites.includes(d.type))
                  .map((def) => (
                    <DraggablePaletteItem key={def.type} def={def} isFavorite onToggleFavorite={() => toggleFavorite(def.type)} onUse={() => trackRecentlyUsed(def.type)} />
                  ))}
              </CollapsibleSection>
            )}
            {Object.entries(componentsByCategory).map(([category, items]) => (
              <CollapsibleSection key={category} title={category} defaultOpen={category === 'Layout' || category === 'Typography'} contentClassName="pb-3">
                {items.map((def) => (
                  <DraggablePaletteItem key={def.type} def={def} isFavorite={favorites.includes(def.type)} onToggleFavorite={() => toggleFavorite(def.type)} onUse={() => trackRecentlyUsed(def.type)} />
                ))}
              </CollapsibleSection>
            ))}
          </>
        )}
      </div>

        <div className="border-t border-slate-800 px-3.5">
          <CollapsibleSection title="Layers" defaultOpen={true} contentClassName="pb-3">
          {hiddenNodeIds.length > 0 && (
            <div className="pb-2">
              <button
                type="button"
                onClick={() => {
                  hiddenNodeIds.forEach((id) => toggleNodeHidden(id));
                }}
                className="w-full cursor-pointer rounded-md border border-blue-700 bg-blue-950/40 px-2 py-1.5 text-[0.72rem] text-blue-300"
              >
                Show hidden ({hiddenNodeIds.length})
              </button>
            </div>
          )}
          <div className="pb-1">
            {pageTree.length === 0 ? (
              <div className="pb-2 text-xs text-slate-600">
                No layers yet
              </div>
            ) : (
              pageTree.map((node) => renderLayerNode(node, 0))
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

function layerMiniBtnClass(enabled: boolean): string {
  return `inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded border border-slate-700 p-0 text-[0.625rem] leading-none ${enabled ? 'cursor-pointer bg-slate-950 text-slate-400' : 'cursor-not-allowed bg-transparent text-slate-700'}`;
}

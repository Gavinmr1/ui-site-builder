/**
 * Bulk Actions Toolbar
 * Shows when multiple nodes are selected, allowing bulk operations
 */

import { useEditorStore } from '../store/editorStore';

export function BulkActionsToolbar() {
  const {
    selectedNodeIds,
    toggleNodeLocked,
    toggleNodeHidden,
    removeNodes,
    isNodeLocked,
    isNodeHidden,
  } = useEditorStore();

  if (selectedNodeIds.length <= 1) {
    return null;
  }

  const allLocked = selectedNodeIds.every((id) => isNodeLocked(id));
  const someLocked = selectedNodeIds.some((id) => isNodeLocked(id));
  const allHidden = selectedNodeIds.every((id) => isNodeHidden(id));
  const someHidden = selectedNodeIds.some((id) => isNodeHidden(id));

  const handleLockToggle = () => {
    selectedNodeIds.forEach((id) => {
      if (!allLocked) {
        if (!isNodeLocked(id)) {
          toggleNodeLocked(id);
        }
      } else {
        toggleNodeLocked(id);
      }
    });
  };

  const handleHideToggle = () => {
    selectedNodeIds.forEach((id) => {
      if (!allHidden) {
        if (!isNodeHidden(id)) {
          toggleNodeHidden(id);
        }
      } else {
        toggleNodeHidden(id);
      }
    });
  };

  const handleDeleteAll = () => {
    if (window.confirm(`Delete ${selectedNodeIds.length} nodes?`)) {
      removeNodes(selectedNodeIds);
    }
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[999] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl"
    >
      <span className="text-sm font-medium text-slate-300">
        {selectedNodeIds.length} selected
      </span>

      <div className="h-6 w-px bg-slate-600" />

      <button
        onClick={handleLockToggle}
        title={allLocked ? 'Unlock all' : 'Lock all'}
        className={`cursor-pointer rounded border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 ${someLocked ? 'bg-slate-700' : 'bg-transparent'}`}
      >
        {someLocked ? '🔒' : '🔓'} Lock
      </button>

      <button
        onClick={handleHideToggle}
        title={allHidden ? 'Show all' : 'Hide all'}
        className={`cursor-pointer rounded border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 ${someHidden ? 'bg-slate-700' : 'bg-transparent'}`}
      >
        {someHidden ? '👁️' : '👁️‍🗨️'} Hide
      </button>

      <button
        onClick={handleDeleteAll}
        title="Delete all selected"
        className="cursor-pointer rounded border border-red-500 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-900 hover:text-red-50"
      >
        🗑️ Delete
      </button>
    </div>
  );
}

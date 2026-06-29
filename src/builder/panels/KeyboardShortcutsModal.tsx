import { useEffect, useId, useRef } from 'react';

/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts
 */

interface ShortcutsGroup {
  category: string;
  shortcuts: Array<{ keys: string; description: string }>;
}

const SHORTCUTS_GROUPS: ShortcutsGroup[] = [
  {
    category: 'Selection',
    shortcuts: [
      { keys: 'Click', description: 'Select single node' },
      { keys: 'Shift + Click', description: 'Add/remove from selection' },
      { keys: 'Cmd/Ctrl + Click', description: 'Add/remove from selection' },
      { keys: 'Drag', description: 'Marquee select multiple nodes' },
      { keys: 'Escape', description: 'Clear selection' },
    ],
  },
  {
    category: 'Editing',
    shortcuts: [
      { keys: 'Enter', description: 'Start editing selected text node' },
      { keys: 'Double Click', description: 'Start editing text' },
      { keys: 'Escape', description: 'Stop editing' },
    ],
  },
  {
    category: 'Deletion',
    shortcuts: [
      { keys: 'Delete / Backspace', description: 'Delete selected node(s)' },
    ],
  },
  {
    category: 'Copy & Paste',
    shortcuts: [
      { keys: 'Cmd/Ctrl + C', description: 'Copy selected node' },
      { keys: 'Cmd/Ctrl + V', description: 'Paste after selected' },
      { keys: 'Cmd/Ctrl + D', description: 'Duplicate selected' },
    ],
  },
  {
    category: 'Clipboard Styles',
    shortcuts: [
      { keys: 'Cmd/Ctrl + Shift + C', description: 'Copy styles' },
      { keys: 'Cmd/Ctrl + Shift + V', description: 'Paste styles' },
    ],
  },
  {
    category: 'Undo & Redo',
    shortcuts: [
      { keys: 'Cmd/Ctrl + Z', description: 'Undo' },
      { keys: 'Cmd/Ctrl + Shift + Z', description: 'Redo' },
      { keys: 'Cmd/Ctrl + Y', description: 'Redo (alternate)' },
    ],
  },
  {
    category: 'Zoom',
    shortcuts: [
      { keys: 'Cmd/Ctrl + +', description: 'Zoom in' },
      { keys: 'Cmd/Ctrl + -', description: 'Zoom out' },
      { keys: 'Cmd/Ctrl + 0', description: 'Reset zoom' },
    ],
  },
  {
    category: 'Help',
    shortcuts: [
      { keys: 'Cmd/Ctrl + Shift + /', description: 'Show shortcuts (this menu)' },
      { keys: 'Shift + / (?)', description: 'Show shortcuts (this menu)' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="max-h-[80vh] max-w-[700px] overflow-auto rounded-xl bg-slate-800 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h1 id={titleId} className="m-0 text-2xl font-bold text-slate-100">
            Keyboard Shortcuts
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-2xl text-slate-400 hover:text-slate-200"
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <p id={descriptionId} className="mb-6 text-sm leading-6 text-slate-400">
          Use these shortcuts to move faster in the builder. Most actions work while the canvas is focused and no text field is active.
        </p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {SHORTCUTS_GROUPS.map((group) => (
            <div key={group.category}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.06em] text-slate-500">
                {group.category}
              </h2>
              <div className="flex flex-col gap-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <code
                      className="shrink-0 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-amber-300"
                    >
                      {shortcut.keys}
                    </code>
                    <span className="text-sm leading-6 text-slate-300">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-slate-700 pt-6 text-sm text-slate-400">
          <p>Tip: Use <strong>Marquee Selection</strong> to select multiple nodes at once, then use style copy and paste to update them together.</p>
        </div>
      </div>
    </div>
  );
}

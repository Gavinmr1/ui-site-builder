import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { getPageJsx, getPageHtml } from '../export/codeExporter';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';

type CodeMode = 'jsx' | 'html';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CodePanel({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<CodeMode>('jsx');
  const pageTree = useEditorStore((s) => s.pageTree);
  const projectName = useEditorStore((s) => s.projectName);
  const [code, setCode] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode(mode === 'jsx' ? getPageJsx() : getPageHtml(projectName));
  }, [isOpen, mode, pageTree, projectName]);

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    toast('Code copied to clipboard');
  }

  return (
    <div
      ref={panelRef}
      className={`shrink-0 border-t border-slate-800 bg-slate-950 transition-all duration-300 ${isOpen ? 'h-[280px]' : 'h-0 overflow-hidden'}`}
    >
      {isOpen && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                Generated Code
              </span>
              <div className="flex rounded-md border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setMode('jsx')}
                  className={`cursor-pointer rounded-l-md px-3 py-1 text-xs font-medium transition-colors ${mode === 'jsx' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  JSX / React
                </button>
                <button
                  type="button"
                  onClick={() => setMode('html')}
                  className={`cursor-pointer rounded-r-md px-3 py-1 text-xs font-medium transition-colors ${mode === 'html' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  HTML
                </button>
              </div>
              <span className="text-[0.6875rem] text-slate-600">
                {pageTree.length === 0 ? 'No elements on canvas' : `${pageTree.length} root element${pageTree.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-transparent px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
              >
                <Icon name="clipboard" size={14} />
                Copy
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-md border border-slate-800 bg-transparent p-1 text-slate-500 hover:text-slate-300"
                title="Close code panel"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>

          {/* Code area */}
          <div className="flex-1 overflow-auto">
            <pre className="min-h-full p-4 font-mono text-[0.78125rem] leading-relaxed text-slate-300">
              <code>{code || '// Add elements to the canvas to see generated code here'}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { loadTokens, saveTokens, defaultTokens } from '../utils/designTokens';
import type { DesignToken } from '../utils/designTokens';
import { toast } from './Toast';
import { microInputClass } from '../styles/uiClasses';

interface Props {
  onApply: (value: string) => void;
}

export function DesignTokenPicker({ onApply }: Props) {
  const [tokens, setTokens] = useState<DesignToken[]>(() => loadTokens());
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editName, setEditName] = useState('');

  useEffect(() => {
    saveTokens(tokens);
  }, [tokens]);

  const colorTokens = tokens.filter((t) => t.category === 'color');

  function startEdit(t: DesignToken) {
    setEditing(t.id);
    setEditValue(t.value);
    setEditName(t.name);
  }

  function saveEdit() {
    if (!editing) return;
    setTokens((prev) =>
      prev.map((t) => (t.id === editing ? { ...t, name: editName, value: editValue } : t))
    );
    setEditing(null);
    toast('Token updated');
  }

  function addToken() {
    const id = `token-${Date.now()}`;
    const newToken: DesignToken = { id, name: 'New Color', value: '#6366f1', category: 'color' };
    setTokens((prev) => [...prev, newToken]);
    startEdit(newToken);
  }

  function removeToken(id: string) {
    setTokens((prev) => prev.filter((t) => t.id !== id));
  }

  function resetTokens() {
    setTokens(defaultTokens);
    toast('Tokens reset to defaults');
  }

  return (
    <div className="py-1">
      <div className="flex flex-wrap gap-1.5 pb-2">
        {colorTokens.map((t) => (
          <div key={t.id} className="relative">
            {editing === t.id ? (
              <div
                className="absolute bottom-8 left-0 z-[100] w-[min(220px,calc(100vw-3rem))] max-w-[220px] rounded-lg border border-slate-700 bg-slate-800 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-1.5">
                  <label className="text-[0.6875rem] font-semibold text-slate-500">NAME</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`${microInputClass} box-border w-full`}
                  />
                </div>
                <div className="mb-2">
                  <label className="text-[0.6875rem] font-semibold text-slate-500">VALUE</label>
                  <div className="flex items-center gap-1.5">
                    <input type="color" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0" />
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className={`${microInputClass} flex-1`}
                    />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={saveEdit} className="flex-1 cursor-pointer rounded border-0 bg-indigo-600 px-1 py-1 text-xs text-white">Save</button>
                  <button type="button" onClick={() => { removeToken(t.id); setEditing(null); }} className="cursor-pointer rounded border border-red-950 bg-transparent px-2 py-1 text-xs text-red-400">Del</button>
                  <button type="button" onClick={() => setEditing(null)} className="cursor-pointer rounded border border-slate-700 bg-transparent px-2 py-1 text-xs text-slate-400">✕</button>
                </div>
              </div>
            ) : null}
            <div
              title={`${t.name}: ${t.value}\nClick to apply, right-click to edit`}
              onClick={() => onApply(t.value)}
              onContextMenu={(e) => { e.preventDefault(); startEdit(t); }}
              style={{
                width: '26px',
                height: '26px',
                backgroundColor: t.value,
                boxSizing: 'border-box',
              }}
              className="cursor-pointer rounded border-2 border-white/10 transition-transform hover:scale-110"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addToken}
          title="Add color token"
          className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded border border-dashed border-slate-700 bg-transparent text-base leading-none text-slate-500"
        >+</button>
      </div>
      <button
        type="button"
        onClick={resetTokens}
        className="cursor-pointer border-0 bg-none p-0 text-[0.6875rem] text-slate-600 hover:text-slate-400"
      >Reset to defaults</button>
    </div>
  );
}

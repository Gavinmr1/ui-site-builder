import { useState } from 'react';
import type { ExportOptions } from '../export/codeExporter';
import {
  ghostButtonClass as sharedGhostButtonClass,
  primaryButtonClass as sharedPrimaryButtonClass,
  textInputClass,
} from '../styles/uiClasses';

const defaultOptions: ExportOptions = {
  mode: 'react-zip',
  includePackageJson: true,
  includeReadme: true,
  includeIndexCss: true,
};

export function ExportOptionsModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: ExportOptions) => void;
}) {
  const [options, setOptions] = useState<ExportOptions>(defaultOptions);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-950/75"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export options"
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-[92vw] rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-200"
      >
        <h3 className="m-0 mb-3 text-base font-bold">Export Options</h3>

        <div className="mb-3">
          <div className="mb-1.5 text-xs text-slate-400">Format</div>
          <select
            value={options.mode}
            onChange={(e) => setOptions((prev) => ({ ...prev, mode: e.target.value as ExportOptions['mode'] }))}
            className={`${textInputClass} rounded-lg bg-slate-950 py-[7px] text-slate-200`}
          >
            <option value="react-zip">React Project (ZIP)</option>
            <option value="html-file">Standalone HTML File</option>
          </select>
        </div>

        <div className="mb-3.5 flex flex-col gap-2.5">
          <label className={labelClass}>
            <input
              type="checkbox"
              checked={options.includePackageJson}
              disabled={options.mode !== 'react-zip'}
              onChange={(e) => setOptions((prev) => ({ ...prev, includePackageJson: e.target.checked }))}
            />
            Include package.json
          </label>

          <label className={labelClass}>
            <input
              type="checkbox"
              checked={options.includeReadme}
              disabled={options.mode !== 'react-zip'}
              onChange={(e) => setOptions((prev) => ({ ...prev, includeReadme: e.target.checked }))}
            />
            Include README.md
          </label>

          <label className={labelClass}>
            <input
              type="checkbox"
              checked={options.includeIndexCss}
              disabled={options.mode !== 'react-zip'}
              onChange={(e) => setOptions((prev) => ({ ...prev, includeIndexCss: e.target.checked }))}
            />
            Include index.css baseline
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostButtonClass}>Cancel</button>
          <button
            type="button"
            onClick={() => onConfirm(options)}
            className={primaryButtonClass}
          >
            {options.mode === 'react-zip' ? 'Export ZIP' : 'Export HTML'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelClass = 'flex items-center gap-2 text-sm text-slate-300';
const ghostButtonClass = `${sharedGhostButtonClass} px-[10px] py-[7px]`;
const primaryButtonClass = `${sharedPrimaryButtonClass} px-3 py-[7px]`;

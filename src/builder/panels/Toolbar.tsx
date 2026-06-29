import { useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { ExportOptionsModal } from '../components/ExportOptionsModal';
import { compactInputClass } from '../styles/uiClasses';
import { trackEvent } from '../analytics';
import {
  downloadProjectJson,
  loadProjectFromLocalStorage,
  readProjectJsonFile,
  saveProjectToLocalStorage,
} from '../persistence/projectStorage';
import { exportProjectWithOptions, copyPageHtml, type ExportOptions } from '../export/codeExporter';
import {
  downloadV2ParityReport,
  downloadV2MigrationSnapshot,
  downloadV2ReactTailwindPage,
  downloadV2ReactTailwindProjectZip,
} from '../../v2/export';

export function Toolbar() {
  const {
    undo,
    redo,
    undoStack,
    redoStack,
    projectName,
    setProjectName,
    updatedAt,
    lastPersistedAt,
    createProjectSnapshot,
    loadProjectFile,
    resetProject,
    markPersisted,
  } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  function handleSave() {
    const snapshot = createProjectSnapshot();
    saveProjectToLocalStorage(snapshot);
    markPersisted();
    trackEvent('project_saved', {
      nodeCount: snapshot.pages.length,
      projectName: snapshot.name,
    });
    toast('Project saved');
  }

  function handleLoad() {
    const saved = loadProjectFromLocalStorage();
    if (!saved) {
      toast('No saved project found', 'error');
      return;
    }
    loadProjectFile(saved);
    markPersisted();
    trackEvent('project_loaded', {
      source: 'local-storage',
      projectName: saved.name,
      nodeCount: saved.pages.length,
    });
    toast('Project loaded');
  }

  function handleDownloadProject() {
    const snapshot = createProjectSnapshot();
    downloadProjectJson(snapshot);
    trackEvent('project_downloaded', {
      projectName: snapshot.name,
      nodeCount: snapshot.pages.length,
    });
    toast('Project downloaded');
  }

  function handleDownloadV2Migration() {
    const snapshot = createProjectSnapshot();
    const result = downloadV2MigrationSnapshot(snapshot);
    trackEvent('project_downloaded', {
      projectName: snapshot.name,
      nodeCount: snapshot.pages.length,
      format: 'v2-migration',
      valid: result.valid,
      issues: result.issues,
      customFallbackCount: result.customFallbackCount,
      totalMappedNodes: result.totalNodes,
      roundTripNodeDelta: result.roundTripNodeDelta,
      roundTripStableByCount: result.roundTripStableByCount,
    });

    if (result.valid) {
      toast(
        `V2 migration snapshot downloaded (${result.customFallbackCount} custom fallback nodes, round-trip delta ${result.roundTripNodeDelta})`
      );
      return;
    }

    toast(
      `V2 snapshot downloaded with ${result.issues} issue(s), ${result.customFallbackCount} custom fallback nodes`,
      'info'
    );
  }

  function handleDownloadV2Parity() {
    const snapshot = createProjectSnapshot();
    const result = downloadV2ParityReport(snapshot);
    trackEvent('project_downloaded', {
      projectName: snapshot.name,
      nodeCount: snapshot.pages.length,
      format: 'v2-parity-report',
      valid: result.valid,
      issues: result.issues,
      customFallbackCount: result.customFallbackCount,
      totalMappedNodes: result.totalNodes,
      roundTripNodeDelta: result.roundTripNodeDelta,
      roundTripStableByCount: result.roundTripStableByCount,
      missingRequiredFieldCount: result.missingRequiredFieldCount ?? 0,
      qualityScore: result.qualityScore ?? 0,
    });

    toast(
      `V2 parity report downloaded (score ${result.qualityScore ?? 0}/100, ${result.customFallbackCount} custom fallback, ${result.missingRequiredFieldCount ?? 0} missing required field(s))`,
      'info'
    );
  }

  function handleDownloadV2ReactTailwind() {
    const snapshot = createProjectSnapshot();
    const result = downloadV2ReactTailwindPage(snapshot);
    trackEvent('project_downloaded', {
      projectName: snapshot.name,
      nodeCount: snapshot.pages.length,
      format: 'v2-react-tailwind',
      valid: result.valid,
      issues: result.issues,
      customFallbackCount: result.customFallbackCount,
      totalMappedNodes: result.totalNodes,
      roundTripNodeDelta: result.roundTripNodeDelta,
      roundTripStableByCount: result.roundTripStableByCount,
    });

    if (result.valid) {
      toast(
        `V2 React + Tailwind page downloaded (${result.customFallbackCount} custom fallback nodes, round-trip delta ${result.roundTripNodeDelta})`
      );
      return;
    }

    toast(
      `V2 React page downloaded with ${result.issues} issue(s), ${result.customFallbackCount} custom fallback nodes`,
      'info'
    );
  }

  async function handleDownloadV2ReactTailwindZip() {
    const snapshot = createProjectSnapshot();
    try {
      const result = await downloadV2ReactTailwindProjectZip(snapshot);
      trackEvent('project_downloaded', {
        projectName: snapshot.name,
        nodeCount: snapshot.pages.length,
        format: 'v2-react-tailwind-zip',
        valid: result.valid,
        issues: result.issues,
        customFallbackCount: result.customFallbackCount,
        totalMappedNodes: result.totalNodes,
        roundTripNodeDelta: result.roundTripNodeDelta,
        roundTripStableByCount: result.roundTripStableByCount,
      });

      if (result.valid) {
        toast(
          `V2 React + Tailwind ZIP downloaded (${result.customFallbackCount} custom fallback nodes, round-trip delta ${result.roundTripNodeDelta})`
        );
        return;
      }

      toast(
        `V2 ZIP downloaded with ${result.issues} issue(s), ${result.customFallbackCount} custom fallback nodes`,
        'info'
      );
    } catch {
      toast('V2 ZIP export failed', 'error');
    }
  }

  async function handleExportReact(options: ExportOptions) {
    setIsExporting(true);
    try {
      await exportProjectWithOptions(options);
      toast(options.mode === 'react-zip' ? 'React project exported' : 'Standalone HTML exported');
    } catch {
      toast('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  }

  function handleCopyCode() {
    copyPageHtml();
    trackEvent('code_copied', { source: 'toolbar' });
    toast('React code copied to clipboard');
  }

  async function handleImportProjectFile(file: File) {
    setIsImporting(true);
    try {
      const parsed = await readProjectJsonFile(file);
      loadProjectFile(parsed);
      saveProjectToLocalStorage(parsed);
      markPersisted();
      trackEvent('project_imported', {
        fileName: file.name,
        projectName: parsed.name,
        nodeCount: parsed.pages.length,
      });
      toast('Project imported');
    } catch {
      toast('Could not import project file', 'error');
    } finally {
      setIsImporting(false);
    }
  }

  const isSaved = !!lastPersistedAt && new Date(lastPersistedAt).getTime() >= new Date(updatedAt).getTime();
  const savedLabel = lastPersistedAt
    ? new Date(lastPersistedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div
      aria-busy={isExporting || isImporting}
      className="min-h-[52px] shrink-0 select-none border-b border-slate-800 bg-slate-950 px-3 py-2 flex flex-wrap items-center gap-2"
    >
      {/* Brand */}
      <span className="mr-4 text-base font-bold bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-transparent">
        SiteBuilder
      </span>

      {/* Undo / Redo */}
      <ToolbarButton onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
        <Icon name="chevron-left" size={18} />
      </ToolbarButton>
      <ToolbarButton onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
        <Icon name="chevron-right" size={18} />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={handleSave} title="Save project to local storage">
        <Icon name="check" size={18} />
      </ToolbarButton>
      <ToolbarMenu title="Project" icon="folder">
        <ToolbarMenuItem onClick={handleLoad}>
          <Icon name="folder" size={14} />
          Load from local storage
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={resetProject}>
          <Icon name="document" size={14} />
          New empty project
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={handleDownloadProject}>
          <Icon name="download" size={14} />
          Download JSON
        </ToolbarMenuItem>
        <ToolbarMenuItem
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          <Icon name="upload" size={14} />
          {isImporting ? 'Importing...' : 'Import project JSON'}
        </ToolbarMenuItem>
      </ToolbarMenu>
      <ToolbarMenu title="V2 Export" icon="sparkles">
        <ToolbarMenuItem onClick={handleDownloadV2Migration}>
          V2 migration snapshot
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={handleDownloadV2Parity}>
          V2 parity report
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={handleDownloadV2ReactTailwind}>
          V2 React + Tailwind page
        </ToolbarMenuItem>
        <ToolbarMenuItem onClick={() => { void handleDownloadV2ReactTailwindZip(); }}>
          V2 React + Tailwind ZIP
        </ToolbarMenuItem>
      </ToolbarMenu>
      <ToolbarButton onClick={handleCopyCode} title="Copy page React code to clipboard">
        <Icon name="clipboard" size={18} />
      </ToolbarButton>

      <Divider />

      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name"
        aria-label="Project name"
        className={`${compactInputClass} w-[150px] md:w-[190px]`}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Import project JSON"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleImportProjectFile(file);
          }
          e.currentTarget.value = '';
        }}
      />

      {/* Spacer */}
      <div className="flex-1" />

      <div className={`px-1.5 text-xs flex items-center gap-1.5 ${isSaved ? 'text-green-300' : 'text-amber-300'}`}>
        <span
          className={`h-[7px] w-[7px] rounded-full ${isSaved ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`}
        />
        <span className="hidden lg:inline">{isSaved ? `Saved${savedLabel ? ` ${savedLabel}` : ''}` : 'Unsaved changes'}</span>
      </div>

      <ToolbarButton
        onClick={() => setShowExportOptions(true)}
        disabled={isExporting}
        variant="primary"
        title="Export React code"
      >
        {isExporting ? <span className="text-xs">Exporting...</span> : <Icon name="code" size={18} />}
      </ToolbarButton>

      <ExportOptionsModal
        isOpen={showExportOptions}
        onClose={() => setShowExportOptions(false)}
        onConfirm={(options) => {
          setShowExportOptions(false);
          void handleExportReact(options);
        }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="mx-1 h-6 w-px bg-slate-800" />
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  variant,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'primary';
  title?: string;
}) {
  const isPrimary = variant === 'primary';
  const className = [
    'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
    isPrimary ? 'bg-indigo-500 text-white font-semibold border border-transparent' : 'border border-transparent font-normal',
    !isPrimary && active ? 'bg-slate-800 text-indigo-300' : '',
    !isPrimary && !active && !disabled ? 'text-slate-400 hover:bg-slate-900' : '',
    !isPrimary && disabled ? 'text-slate-700 cursor-not-allowed' : '',
    isPrimary && disabled ? 'opacity-60 cursor-not-allowed' : '',
  ].join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={className}
    >
      {children}
    </button>
  );
}

function ToolbarMenu({
  title,
  icon,
  children,
}: {
  title: string;
  icon: 'folder' | 'sparkles';
  children: React.ReactNode;
}) {
  return (
    <details className="group relative">
      <summary className="list-none">
        <ToolbarButton onClick={() => {}} title={title}>
          <Icon name={icon} size={16} />
          <span className="text-xs">{title}</span>
          <Icon name="chevron-down" size={14} />
        </ToolbarButton>
      </summary>
      <div className="absolute left-0 z-[220] mt-1 min-w-[230px] rounded-md border border-slate-700 bg-slate-900 p-1.5 shadow-[0_14px_36px_rgba(2,6,23,0.65)]">
        {children}
      </div>
    </details>
  );
}

function ToolbarMenuItem({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${disabled ? 'cursor-not-allowed text-slate-600' : 'cursor-pointer text-slate-300 hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}

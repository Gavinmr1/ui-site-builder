import { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { resolveResponsiveStyles } from '../utils/responsiveStyles';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { toast } from '../components/Toast';
import { DesignTokenPicker } from '../components/DesignTokenPicker';
import { addTemplate } from '../utils/templates';
import { ASSET_EVENT, loadAssets, type AssetItem } from '../utils/assets';
import { controlFieldClass, textInputClass } from '../styles/uiClasses';
import { themeVar } from '../themes/themeTokens';
import { trackEvent } from '../../builder/analytics';
import {
  getThemeFamilies,
  getThemeForFamilyMode,
  resolveThemeFamilyId,
  resolveThemeMode,
  type ThemeMode,
} from '../themes';
import { allIconNames } from '../components/Icon';
import type { EditorNode } from '../types';
import { introspectNodeFields } from '../../v2/properties/fieldIntrospection';
import { getPrimitiveDefinition } from '../../v2/primitives';

const htmlTextTags = ['span', 'strong', 'em', 'small', 'mark', 'code', 'div', 'p', 'blockquote', 'pre', 'sup', 'sub', 'time'];
const htmlContainerTags = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'form', 'figure', 'figcaption'];

const primitiveSkipFields = new Set([
  'text',
  'level',
  'name',
  'placeholder',
  'type',
  'rows',
  'options',
  'value',
  'src',
  'alt',
  'iconName',
  'href',
  'target',
  'items',
  'poster',
  'ariaLabel',
]);

// ─── Reusable field components ────────────────────────────────────────────────

function FieldRow({
  label,
  children,
  action,
  hasOverride,
  hidden,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hasOverride?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
          {hasOverride ? (
            <span
              title="Override set for this breakpoint"
              className="h-[7px] w-[7px] rounded-full bg-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_8px_rgba(34,211,238,0.6)]"
            />
          ) : (
            <span className="h-[7px] w-[7px] rounded-full bg-slate-800" />
          )}
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? 'Text input'}
      onChange={(e) => onChange(e.target.value)}
      className={textInputClass}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value || '#000000'}
        aria-label="Color picker"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border-0 p-0"
      />
      <input
        type="text"
        value={value || ''}
        placeholder="#000000"
        aria-label="Color value"
        onChange={(e) => onChange(e.target.value)}
        className={`${controlFieldClass} flex-1`}
      />
    </div>
  );
}

// ─── Props panel sections by node type ────────────────────────────────────────

function PropsSection({ nodeId }: { nodeId: string }) {
  const {
    getNode,
    updateNodeProps,
    updateNodeStyles,
    updateNodesStyles,
    clearNodeStyleOverride,
    clearNodeBreakpointStyles,
    removeNode,
    duplicateNode,
    copyNodeStyles,
    pasteNodeStyles,
    styleClipboard,
    activeBreakpoint,
    selectedNodeIds,
    theme,
  } = useEditorStore();
  const node = getNode(nodeId);
  const [assets, setAssets] = useState<AssetItem[]>(() => loadAssets());
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [styleSearch, setStyleSearch] = useState('');
  const [customStyleKey, setCustomStyleKey] = useState('');
  const [customStyleValue, setCustomStyleValue] = useState('');

  useEffect(() => {
    function refreshAssets() {
      setAssets(loadAssets());
    }

    window.addEventListener(ASSET_EVENT, refreshAssets);
    return () => window.removeEventListener(ASSET_EVENT, refreshAssets);
  }, []);

  useEffect(() => {
    if (!assets.length) {
      setSelectedAssetId('');
      return;
    }

    if (!assets.some((asset) => asset.id === selectedAssetId)) {
      setSelectedAssetId(assets[0].id);
    }
  }, [assets, selectedAssetId]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  if (!node) return null;

  const p = node.props;
  const s = resolveResponsiveStyles(node.styles, activeBreakpoint) as Record<string, unknown>;
  const bpOverrides = ((node.styles as Record<string, unknown>)[activeBreakpoint] as Record<string, unknown>) ?? {};
  const v2FieldInsight = useMemo(() => introspectNodeFields(node), [node]);
  const primitiveDefinition = useMemo(() => getPrimitiveDefinition(v2FieldInsight.primitiveType), [v2FieldInsight.primitiveType]);
  const generatedPrimitiveFields = useMemo(
    () => primitiveDefinition.fields.filter((field) => !primitiveSkipFields.has(field.key)),
    [primitiveDefinition.fields]
  );

  const setProps = (patch: Record<string, unknown>) => updateNodeProps(nodeId, patch);
  const setV2PrimitiveField = (key: string, value: unknown) => {
    setProps({ [key]: value });
    trackEvent('node_updated', {
      nodeId,
      sourceType: node.type,
      primitiveType: v2FieldInsight.primitiveType,
      fieldKey: key,
      updatedVia: 'v2-primitive-controls',
    });
  };
  const setStyles = (patch: Record<string, unknown>) => {
    if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
      updateNodesStyles(selectedNodeIds, patch);
      return;
    }
    updateNodeStyles(nodeId, patch);
  };
  const hasOverrides = Object.keys(bpOverrides).length > 0;
  const spacingTokenEntries = Object.entries(theme.spacing);
  const radiusTokenEntries = Object.entries(theme.borderRadius);

  const styleQuery = styleSearch.trim().toLowerCase();
  const sectionMatches = (...terms: string[]) =>
    styleQuery.length === 0 || terms.some((term) => term.toLowerCase().includes(styleQuery));
  const structuredContentTypes = new Set([
    'feature-grid',
    'faq',
    'pricing-table',
    'cta-banner',
    'stats-strip',
    'tabs',
    'accordion',
    'timeline',
    'carousel',
    'comparison-table',
    'team-grid',
    'navbar',
  ]);

  const resetAction = (styleKey: string) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(bpOverrides, styleKey);
    if (!hasOverride) return null;

    return (
      <button
        type="button"
        onClick={() => clearNodeStyleOverride(nodeId, styleKey)}
        className={miniResetBtnClass}
        title={`Reset ${styleKey} for ${activeBreakpoint}`}
      >
        Reset
      </button>
    );
  };

  const themeTokenAction = (styleKey: string, tokenValue: string) => (
    <button
      type="button"
      onClick={() => setStyles({ [styleKey]: tokenValue })}
      className={miniThemeBtnClass}
      title={`Use site theme token for ${styleKey}`}
    >
      Theme
    </button>
  );

  const combinedFieldAction = (styleKey: string, tokenValue: string) => (
    <div className="flex items-center gap-1">
      {themeTokenAction(styleKey, tokenValue)}
      {resetAction(styleKey)}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div
        className="w-fit rounded-full border border-cyan-700 bg-cyan-950 px-2 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-cyan-400"
      >
        Editing: {activeBreakpoint}
      </div>

      <button
        type="button"
        onClick={() => clearNodeBreakpointStyles(nodeId)}
        disabled={!hasOverrides}
        className={`w-full rounded-md border px-3 py-1.5 text-[0.8125rem] ${hasOverrides ? 'cursor-pointer border-cyan-700 text-cyan-400' : 'cursor-not-allowed border-slate-800 text-slate-700'}`}
        title={`Clear all ${activeBreakpoint} overrides`}
      >
        Reset {activeBreakpoint} Overrides
      </button>

      <div className="rounded-md border border-slate-800 bg-slate-950/70 p-2">
        <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
          Search Styles
        </label>
        <input
          type="text"
          value={styleSearch}
          onChange={(e) => setStyleSearch(e.target.value)}
          placeholder="Filter style sections..."
          className={textInputClass}
        />
      </div>

      {/* Node actions */}
      <CollapsibleSection title="Actions" defaultOpen={true}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { duplicateNode(nodeId); toast('Element duplicated'); }}
            className={actionBtnClass}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => { removeNode(nodeId); toast('Element deleted', 'info'); }}
            className={`${actionBtnClass} border-red-950 text-red-400`}
          >
            Delete
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => { copyNodeStyles(nodeId); toast('Styles copied'); }}
            className={actionBtnClass}
          >
            Copy Styles
          </button>
          <button
            type="button"
            onClick={() => {
              pasteNodeStyles(nodeId);
              if (selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
                toast(`Styles pasted to ${selectedNodeIds.length} elements`);
                return;
              }
              toast('Styles pasted');
            }}
            disabled={!styleClipboard}
            className={`flex-1 rounded-md border px-3 py-1.5 text-[0.8125rem] ${styleClipboard ? 'cursor-pointer border-blue-700 text-blue-300' : 'cursor-not-allowed border-slate-800 text-slate-700'}`}
          >
            Paste Styles
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              const suggestedName = `${node.type} block`;
              const name = window.prompt('Name this custom component', suggestedName) ?? '';
              if (!name.trim()) return;
              const created = addTemplate(name, node);
              if (!created) {
                toast('Could not save template. Storage may be unavailable.', 'error');
                return;
              }
              toast('Saved as template');
            }}
            className={actionBtnClass}
          >
            Save as Template
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="V2 Field Insight" defaultOpen={false}>
        <div className="rounded-md border border-slate-800 bg-slate-950/80 p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-slate-500">
            <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-cyan-300">
              source: {v2FieldInsight.sourceType}
            </span>
            <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em] text-emerald-300">
              primitive: {v2FieldInsight.primitiveType}
            </span>
          </div>

          {v2FieldInsight.fields.length === 0 ? (
            <p className="m-0 text-xs text-slate-500">No primitive fields are currently defined for this node type.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {v2FieldInsight.fields.map((field) => (
                <div key={field.key} className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300">{field.label}</span>
                    <span
                      className={`text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${field.present ? 'text-emerald-400' : field.required ? 'text-amber-400' : 'text-slate-600'}`}
                    >
                      {field.present ? 'set' : field.required ? 'missing' : 'optional'}
                    </span>
                  </div>
                  <p className="mt-0.5 mb-0 text-[0.72rem] text-slate-500">{field.key}{field.valuePreview ? `: ${field.valuePreview}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="V2 Primitive Controls" defaultOpen={false}>
        {generatedPrimitiveFields.length === 0 ? (
          <p className="m-0 text-xs text-slate-500">
            Primitive-defined fields for this node are already covered by dedicated editors.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {generatedPrimitiveFields.map((field) => {
              const currentValue = p[field.key];

              if (field.type === 'number') {
                return (
                  <FieldRow key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                    <input
                      type="number"
                      value={typeof currentValue === 'number' ? currentValue : Number(currentValue ?? 0)}
                      onChange={(e) => setV2PrimitiveField(field.key, Number(e.target.value) || 0)}
                      className={textInputClass}
                    />
                  </FieldRow>
                );
              }

              if (field.type === 'boolean') {
                return (
                  <FieldRow key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                    <select
                      value={String(Boolean(currentValue))}
                      onChange={(e) => setV2PrimitiveField(field.key, e.target.value === 'true')}
                      className={selectClass}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </FieldRow>
                );
              }

              if (field.type === 'list') {
                const listValue = Array.isArray(currentValue) ? currentValue.map((item) => String(item)).join('\n') : '';

                return (
                  <FieldRow key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                    <textarea
                      value={listValue}
                      onChange={(e) => {
                        const next = e.target.value
                          .split('\n')
                          .map((item) => item.trim())
                          .filter(Boolean);
                        setV2PrimitiveField(field.key, next);
                      }}
                      className={`${textInputClass} min-h-[92px] resize-y`}
                    />
                  </FieldRow>
                );
              }

              return (
                <FieldRow key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
                  <TextInput value={String(currentValue ?? '')} onChange={(v) => setV2PrimitiveField(field.key, v)} />
                </FieldRow>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Type-specific props */}
      <CollapsibleSection title="Content" defaultOpen={true}>
        {(node.type === 'heading') && (
          <>
            <FieldRow label="Text">
              <TextInput value={p.text as string ?? ''} onChange={(v) => setProps({ text: v })} />
            </FieldRow>
            <FieldRow label="Level">
              <select
                value={(p.level as number) ?? 2}
                onChange={(e) => setProps({ level: Number(e.target.value) })}
                className={selectClass}
              >
                {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>H{l}</option>)}
              </select>
            </FieldRow>
          </>
        )}

        {(node.type === 'paragraph' || node.type === 'label' || node.type === 'badge') && (
          <FieldRow label="Text">
            <TextInput value={p.text as string ?? ''} onChange={(v) => setProps({ text: v })} />
          </FieldRow>
        )}

        {(node.type === 'link') && (
          <>
            <FieldRow label="Text">
              <TextInput value={p.text as string ?? ''} onChange={(v) => setProps({ text: v })} />
            </FieldRow>
            <FieldRow label="URL">
              <TextInput value={p.href as string ?? ''} onChange={(v) => setProps({ href: v })} placeholder="https://example.com" />
            </FieldRow>
            <FieldRow label="Target">
              <select value={p.target as string ?? '_blank'} onChange={(e) => setProps({ target: e.target.value })} className={selectClass}>
                <option value="_self">Same tab</option>
                <option value="_blank">New tab</option>
              </select>
            </FieldRow>
          </>
        )}

        {(node.type === 'list') && (
          <>
            <FieldRow label="List Type">
              <select value={String(!!p.ordered)} onChange={(e) => setProps({ ordered: e.target.value === 'true' })} className={selectClass}>
                <option value="false">Bulleted</option>
                <option value="true">Numbered</option>
              </select>
            </FieldRow>
            <FieldRow label="Items (one per line)">
              <textarea
                value={((p.items as string[]) ?? []).join('\n')}
                onChange={(e) => setProps({ items: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })}
                className={`${textInputClass} min-h-[92px] resize-y`}
              />
            </FieldRow>
          </>
        )}

        {(node.type === 'html-element') && (
          <>
            <FieldRow label="Element">
              <select value={p.tag as string ?? 'span'} onChange={(e) => setProps({ tag: e.target.value })} className={selectClass}>
                {htmlTextTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Text">
              <TextInput value={p.text as string ?? ''} onChange={(v) => setProps({ text: v })} />
            </FieldRow>
          </>
        )}

        {(node.type === 'html-container') && (
          <>
            <FieldRow label="Container Tag">
              <select value={p.tag as string ?? 'div'} onChange={(e) => setProps({ tag: e.target.value })} className={selectClass}>
                {htmlContainerTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </FieldRow>
            <p className="text-xs leading-5 text-slate-500">
              This semantic wrapper can contain child elements and is useful for article, section, nav, aside, and similar layout structure.
            </p>
          </>
        )}

        {(node.type === 'icon') && (
          <>
            <FieldRow label="Icon">
              <select value={p.iconName as string ?? 'sparkles'} onChange={(e) => setProps({ iconName: e.target.value })} className={selectClass}>
                {allIconNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Size (px)">
              <TextInput value={String(p.size ?? 28)} onChange={(v) => setProps({ size: Number(v) || 28 })} />
            </FieldRow>
            <FieldRow label="Stroke Width">
              <TextInput value={String(p.strokeWidth ?? 2)} onChange={(v) => setProps({ strokeWidth: Number(v) || 2 })} />
            </FieldRow>
            <FieldRow label="Aria Label">
              <TextInput value={p.ariaLabel as string ?? 'Decorative icon'} onChange={(v) => setProps({ ariaLabel: v })} />
            </FieldRow>
          </>
        )}

        {node.type === 'button' && (
          <FieldRow label="Label">
            <TextInput value={p.text as string ?? ''} onChange={(v) => setProps({ text: v })} />
          </FieldRow>
        )}

        {node.type === 'input' && (
          <>
            <FieldRow label="Placeholder">
              <TextInput value={p.placeholder as string ?? ''} onChange={(v) => setProps({ placeholder: v })} />
            </FieldRow>
            <FieldRow label="Field Name">
              <TextInput value={p.name as string ?? ''} onChange={(v) => setProps({ name: v })} />
            </FieldRow>
            <FieldRow label="Aria Label">
              <TextInput value={p.ariaLabel as string ?? ''} onChange={(v) => setProps({ ariaLabel: v })} />
            </FieldRow>
            <FieldRow label="Type">
              <select value={p.type as string ?? 'text'} onChange={(e) => setProps({ type: e.target.value })} className={selectClass}>
                {['text', 'email', 'password', 'number', 'tel', 'url'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </FieldRow>
          </>
        )}

        {node.type === 'textarea' && (
          <>
            <FieldRow label="Placeholder">
              <TextInput value={p.placeholder as string ?? ''} onChange={(v) => setProps({ placeholder: v })} />
            </FieldRow>
            <FieldRow label="Field Name">
              <TextInput value={p.name as string ?? ''} onChange={(v) => setProps({ name: v })} />
            </FieldRow>
            <FieldRow label="Aria Label">
              <TextInput value={p.ariaLabel as string ?? ''} onChange={(v) => setProps({ ariaLabel: v })} />
            </FieldRow>
            <FieldRow label="Rows">
              <TextInput value={String(p.rows ?? 5)} onChange={(v) => setProps({ rows: Number(v) || 5 })} />
            </FieldRow>
            <FieldRow label="Default Value">
              <textarea
                value={p.value as string ?? ''}
                onChange={(e) => setProps({ value: e.target.value })}
                className={`${textInputClass} min-h-[92px] resize-y`}
              />
            </FieldRow>
          </>
        )}

        {node.type === 'select' && (
          <>
            <FieldRow label="Field Name">
              <TextInput value={p.name as string ?? ''} onChange={(v) => setProps({ name: v })} />
            </FieldRow>
            <FieldRow label="Aria Label">
              <TextInput value={p.ariaLabel as string ?? ''} onChange={(v) => setProps({ ariaLabel: v })} />
            </FieldRow>
            <FieldRow label="Selected Value">
              <TextInput value={p.value as string ?? ''} onChange={(v) => setProps({ value: v })} placeholder="starter" />
            </FieldRow>
            <FieldRow label="Options (one per line)">
              <textarea
                value={((p.options as string[]) ?? []).join('\n')}
                onChange={(e) => {
                  const options = e.target.value.split('\n').map((item) => item.trim()).filter(Boolean);
                  setProps({ options, value: options[0]?.toLowerCase().replace(/\s+/g, '-') ?? '' });
                }}
                className={`${textInputClass} min-h-[92px] resize-y`}
              />
            </FieldRow>
          </>
        )}

        {node.type === 'image' && (
          <>
            <FieldRow label="Image URL">
              <TextInput value={p.src as string ?? ''} onChange={(v) => setProps({ src: v })} placeholder="https://..." />
            </FieldRow>
            <FieldRow label="Alt text">
              <TextInput value={p.alt as string ?? ''} onChange={(v) => setProps({ alt: v })} />
            </FieldRow>
            {assets.length > 0 && (
              <>
                <FieldRow label="From Assets">
                  <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)} className={selectClass}>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </FieldRow>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedAsset) return;
                    setProps({ src: selectedAsset.url, alt: (p.alt as string) || selectedAsset.name });
                    toast('Image source set from assets');
                  }}
                  className={actionBtnClass}
                >
                  Apply Selected Asset
                </button>
              </>
            )}
          </>
        )}


        {node.type === 'hero' && (
          <>
            <FieldRow label="Title">
              <TextInput value={p.title as string ?? ''} onChange={(v) => setProps({ title: v })} />
            </FieldRow>
            <FieldRow label="Subtitle">
              <TextInput value={p.subtitle as string ?? ''} onChange={(v) => setProps({ subtitle: v })} />
            </FieldRow>
            <FieldRow label="Button Text">
              <TextInput value={p.ctaText as string ?? ''} onChange={(v) => setProps({ ctaText: v })} />
            </FieldRow>
          </>
        )}

        {node.type === 'footer' && (
          <FieldRow label="Copyright">
            <TextInput value={p.copyright as string ?? ''} onChange={(v) => setProps({ copyright: v })} />
          </FieldRow>
        )}

        {node.type === 'video' && (
          <>
            <FieldRow label="Video URL">
              <TextInput value={p.src as string ?? ''} onChange={(v) => setProps({ src: v })} placeholder="https://example.com/video.mp4" />
            </FieldRow>
            <FieldRow label="Poster Image URL">
              <TextInput value={p.poster as string ?? ''} onChange={(v) => setProps({ poster: v })} placeholder="https://..." />
            </FieldRow>
            <FieldRow label="Show Controls">
              <select value={String(p.controls ?? true)} onChange={(e) => setProps({ controls: e.target.value === 'true' })} className={selectClass}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FieldRow>
          </>
        )}

        {node.type === 'testimonial' && (
          <>
            <FieldRow label="Quote">
              <TextInput value={p.quote as string ?? ''} onChange={(v) => setProps({ quote: v })} placeholder="Enter testimonial quote..." />
            </FieldRow>
            <FieldRow label="Author">
              <TextInput value={p.author as string ?? ''} onChange={(v) => setProps({ author: v })} />
            </FieldRow>
            <FieldRow label="Role / Company">
              <TextInput value={p.role as string ?? ''} onChange={(v) => setProps({ role: v })} placeholder="CEO, Example Co" />
            </FieldRow>
          </>
        )}

        {structuredContentTypes.has(node.type) && (
        <CollapsibleSection title="Structured Content" defaultOpen={true} contentClassName="pt-1">
        {node.type === 'feature-grid' && (() => {
          type Feature = { title: string; description: string };
          const features = (p.features as Feature[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Features</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ features: [...features, { title: 'Feature', description: 'Description here.' }] })}
                >+ Add</button>
              </div>
              {features.map((feat, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <TextInput value={feat.title} onChange={(v) => {
                    const next = features.map((f, j) => j === i ? { ...f, title: v } : f);
                    setProps({ features: next });
                  }} placeholder="Feature title" />
                  <div className="mt-1.5">
                    <TextInput value={feat.description} onChange={(v) => {
                      const next = features.map((f, j) => j === i ? { ...f, description: v } : f);
                      setProps({ features: next });
                    }} placeholder="Feature description" />
                  </div>
                  <button type="button" onClick={() => setProps({ features: features.filter((_, j) => j !== i) })}
                    className="mt-1.5 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'faq' && (() => {
          type QA = { q: string; a: string };
          const questions = (p.questions as QA[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Q&amp;A Items</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ questions: [...questions, { q: 'New question?', a: 'Answer here.' }] })}
                >+ Add</button>
              </div>
              {questions.map((item, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <TextInput value={item.q} onChange={(v) => {
                    const next = questions.map((it, j) => j === i ? { ...it, q: v } : it);
                    setProps({ questions: next });
                  }} placeholder="Question" />
                  <div className="mt-1.5">
                    <TextInput value={item.a} onChange={(v) => {
                      const next = questions.map((it, j) => j === i ? { ...it, a: v } : it);
                      setProps({ questions: next });
                    }} placeholder="Answer" />
                  </div>
                  <button type="button" onClick={() => setProps({ questions: questions.filter((_, j) => j !== i) })}
                    className="mt-1.5 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'pricing-table' && (() => {
          type Plan = { name: string; price: string; features: string[]; ctaText: string; highlighted?: boolean };
          const plans = (p.plans as Plan[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Plans</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ plans: [...plans, { name: 'New Plan', price: '$9/mo', features: ['Feature 1'], ctaText: 'Get Started' }] })}
                >+ Add</button>
              </div>
              {plans.map((plan, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Name"><TextInput value={plan.name} onChange={(v) => { const next = plans.map((pl, j) => j === i ? { ...pl, name: v } : pl); setProps({ plans: next }); }} /></FieldRow>
                  <FieldRow label="Price"><TextInput value={plan.price} onChange={(v) => { const next = plans.map((pl, j) => j === i ? { ...pl, price: v } : pl); setProps({ plans: next }); }} placeholder="$9/mo" /></FieldRow>
                  <FieldRow label="CTA Text"><TextInput value={plan.ctaText} onChange={(v) => { const next = plans.map((pl, j) => j === i ? { ...pl, ctaText: v } : pl); setProps({ plans: next }); }} /></FieldRow>
                  <FieldRow label="Features (one per line)">
                    <textarea
                      value={(plan.features ?? []).join('\n')}
                      onChange={(e) => {
                        const next = plans.map((pl, j) => j === i ? { ...pl, features: e.target.value.split('\n').filter(Boolean) } : pl);
                        setProps({ plans: next });
                      }}
                      rows={3}
                      className="w-full rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 outline-none"
                      placeholder="Feature 1&#10;Feature 2"
                    />
                  </FieldRow>
                  <FieldRow label="Highlighted">
                    <select value={String(plan.highlighted ?? false)} onChange={(e) => { const next = plans.map((pl, j) => j === i ? { ...pl, highlighted: e.target.value === 'true' } : pl); setProps({ plans: next }); }} className={selectClass}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </FieldRow>
                  <button type="button" onClick={() => setProps({ plans: plans.filter((_, j) => j !== i) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'cta-banner' && (
          <>
            <FieldRow label="Eyebrow">
              <TextInput value={p.eyebrow as string ?? ''} onChange={(v) => setProps({ eyebrow: v })} placeholder="Optional small label" />
            </FieldRow>
            <FieldRow label="Title">
              <TextInput value={p.title as string ?? ''} onChange={(v) => setProps({ title: v })} />
            </FieldRow>
            <FieldRow label="Subtitle">
              <TextInput value={p.subtitle as string ?? ''} onChange={(v) => setProps({ subtitle: v })} />
            </FieldRow>
            <FieldRow label="Primary Button Label">
              <TextInput value={p.primaryCta as string ?? ''} onChange={(v) => setProps({ primaryCta: v })} />
            </FieldRow>
            <FieldRow label="Secondary Button Label">
              <TextInput value={p.secondaryCta as string ?? ''} onChange={(v) => setProps({ secondaryCta: v })} />
            </FieldRow>
          </>
        )}

        {node.type === 'stats-strip' && (() => {
          type Stat = { label: string; value: string; helper?: string };
          const stats = (p.stats as Stat[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Stats</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ stats: [...stats, { label: 'New Metric', value: '0', helper: 'Description' }] })}
                >+ Add</button>
              </div>
              {stats.map((stat, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Label"><TextInput value={stat.label} onChange={(v) => {
                    const next = stats.map((item, j) => j === i ? { ...item, label: v } : item);
                    setProps({ stats: next });
                  }} /></FieldRow>
                  <FieldRow label="Value"><TextInput value={stat.value} onChange={(v) => {
                    const next = stats.map((item, j) => j === i ? { ...item, value: v } : item);
                    setProps({ stats: next });
                  }} /></FieldRow>
                  <FieldRow label="Helper Text"><TextInput value={stat.helper ?? ''} onChange={(v) => {
                    const next = stats.map((item, j) => j === i ? { ...item, helper: v } : item);
                    setProps({ stats: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ stats: stats.filter((_, j) => j !== i) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'tabs' && (() => {
          type TabItem = { label: string; content: string };
          const items = (p.items as TabItem[]) ?? [];
          const activeIndex = Number(p.activeIndex ?? 0);
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Tab Items</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ items: [...items, { label: `Tab ${items.length + 1}`, content: 'Tab content' }] })}
                >+ Add</button>
              </div>
              <FieldRow label="Active Tab">
                <select value={String(activeIndex)} onChange={(e) => setProps({ activeIndex: Number(e.target.value) })} className={selectClass}>
                  {items.map((item, i) => (
                    <option key={`${item.label}-${i}`} value={i}>{item.label || `Tab ${i + 1}`}</option>
                  ))}
                </select>
              </FieldRow>
              {items.map((item, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Label"><TextInput value={item.label} onChange={(v) => {
                    const next = items.map((tab, j) => j === i ? { ...tab, label: v } : tab);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <FieldRow label="Content"><TextInput value={item.content} onChange={(v) => {
                    const next = items.map((tab, j) => j === i ? { ...tab, content: v } : tab);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ items: items.filter((_, j) => j !== i), activeIndex: Math.max(0, activeIndex - (i <= activeIndex ? 1 : 0)) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'accordion' && (() => {
          type AccordionItem = { title: string; content: string };
          const items = (p.items as AccordionItem[]) ?? [];
          const openIndex = Number(p.openIndex ?? 0);
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Accordion Items</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ items: [...items, { title: `Item ${items.length + 1}`, content: 'Accordion content' }] })}
                >+ Add</button>
              </div>
              <FieldRow label="Open Item">
                <select value={String(openIndex)} onChange={(e) => setProps({ openIndex: Number(e.target.value) })} className={selectClass}>
                  {items.map((item, i) => (
                    <option key={`${item.title}-${i}`} value={i}>{item.title || `Item ${i + 1}`}</option>
                  ))}
                </select>
              </FieldRow>
              {items.map((item, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Title"><TextInput value={item.title} onChange={(v) => {
                    const next = items.map((entry, j) => j === i ? { ...entry, title: v } : entry);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <FieldRow label="Content"><TextInput value={item.content} onChange={(v) => {
                    const next = items.map((entry, j) => j === i ? { ...entry, content: v } : entry);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ items: items.filter((_, j) => j !== i), openIndex: Math.max(0, openIndex - (i <= openIndex ? 1 : 0)) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'timeline' && (() => {
          type TimelineItem = { date: string; title: string; description: string };
          const items = (p.items as TimelineItem[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Timeline Items</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ items: [...items, { date: 'New date', title: 'Milestone', description: 'Description' }] })}
                >+ Add</button>
              </div>
              {items.map((item, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Date"><TextInput value={item.date} onChange={(v) => {
                    const next = items.map((entry, j) => j === i ? { ...entry, date: v } : entry);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <FieldRow label="Title"><TextInput value={item.title} onChange={(v) => {
                    const next = items.map((entry, j) => j === i ? { ...entry, title: v } : entry);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <FieldRow label="Description"><TextInput value={item.description} onChange={(v) => {
                    const next = items.map((entry, j) => j === i ? { ...entry, description: v } : entry);
                    setProps({ items: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ items: items.filter((_, j) => j !== i) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'carousel' && (() => {
          type Slide = { title: string; description: string; image: string };
          const slides = (p.slides as Slide[]) ?? [];
          const activeIndex = Number(p.activeIndex ?? 0);
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Slides</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ slides: [...slides, { title: `Slide ${slides.length + 1}`, description: 'Slide description', image: 'https://placehold.co/1200x600/1e293b/f8fafc?text=New+Slide' }] })}
                >+ Add</button>
              </div>
              <FieldRow label="Active Slide">
                <select value={String(activeIndex)} onChange={(e) => setProps({ activeIndex: Number(e.target.value) })} className={selectClass}>
                  {slides.map((slide, i) => (
                    <option key={`${slide.title}-${i}`} value={i}>{slide.title || `Slide ${i + 1}`}</option>
                  ))}
                </select>
              </FieldRow>
              {slides.map((slide, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Title"><TextInput value={slide.title} onChange={(v) => {
                    const next = slides.map((item, j) => j === i ? { ...item, title: v } : item);
                    setProps({ slides: next });
                  }} /></FieldRow>
                  <FieldRow label="Description"><TextInput value={slide.description} onChange={(v) => {
                    const next = slides.map((item, j) => j === i ? { ...item, description: v } : item);
                    setProps({ slides: next });
                  }} /></FieldRow>
                  <FieldRow label="Image URL"><TextInput value={slide.image} onChange={(v) => {
                    const next = slides.map((item, j) => j === i ? { ...item, image: v } : item);
                    setProps({ slides: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ slides: slides.filter((_, j) => j !== i), activeIndex: Math.max(0, activeIndex - (i <= activeIndex ? 1 : 0)) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'comparison-table' && (() => {
          type TableRow = { feature: string; values: string[] };
          const columns = (p.columns as string[]) ?? [];
          const rows = (p.rows as TableRow[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Columns</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => {
                    const nextColumns = [...columns, `Plan ${columns.length + 1}`];
                    const nextRows = rows.map((row) => ({ ...row, values: [...row.values, '-'] }));
                    setProps({ columns: nextColumns, rows: nextRows });
                  }}
                >+ Add Column</button>
              </div>
              {columns.map((col, i) => (
                <div key={i} className="mb-1.5 flex items-center gap-1.5">
                  <TextInput value={col} onChange={(v) => setProps({ columns: columns.map((c, j) => j === i ? v : c) })} />
                  <button type="button" onClick={() => {
                    if (columns.length <= 1) return;
                    const nextColumns = columns.filter((_, j) => j !== i);
                    const nextRows = rows.map((row) => ({ ...row, values: row.values.filter((_, j) => j !== i) }));
                    setProps({ columns: nextColumns, rows: nextRows });
                  }} className="shrink-0 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-1 text-xs text-red-400">×</button>
                </div>
              ))}

              <div className="mb-1 mt-2 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Rows</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ rows: [...rows, { feature: 'New Feature', values: columns.map(() => '-') }] })}
                >+ Add Row</button>
              </div>
              {rows.map((row, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Feature"><TextInput value={row.feature} onChange={(v) => {
                    const next = rows.map((entry, j) => j === i ? { ...entry, feature: v } : entry);
                    setProps({ rows: next });
                  }} /></FieldRow>
                  {columns.map((col, colIdx) => (
                    <FieldRow key={`${col}-${colIdx}`} label={col || `Column ${colIdx + 1}`}>
                      <TextInput value={row.values[colIdx] ?? ''} onChange={(v) => {
                        const next = rows.map((entry, j) => {
                          if (j !== i) return entry;
                          const values = [...entry.values];
                          values[colIdx] = v;
                          return { ...entry, values };
                        });
                        setProps({ rows: next });
                      }} />
                    </FieldRow>
                  ))}
                  <button type="button" onClick={() => setProps({ rows: rows.filter((_, j) => j !== i) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove Row
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'team-grid' && (() => {
          type Member = { name: string; role: string; bio: string; avatar: string };
          const members = (p.members as Member[]) ?? [];
          return (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Members</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                  onClick={() => setProps({ members: [...members, { name: 'New Member', role: 'Role', bio: 'Short bio', avatar: 'https://placehold.co/300x300/1e293b/f8fafc?text=NM' }] })}
                >+ Add</button>
              </div>
              {members.map((member, i) => (
                <div key={i} className="mb-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                  <FieldRow label="Name"><TextInput value={member.name} onChange={(v) => {
                    const next = members.map((entry, j) => j === i ? { ...entry, name: v } : entry);
                    setProps({ members: next });
                  }} /></FieldRow>
                  <FieldRow label="Role"><TextInput value={member.role} onChange={(v) => {
                    const next = members.map((entry, j) => j === i ? { ...entry, role: v } : entry);
                    setProps({ members: next });
                  }} /></FieldRow>
                  <FieldRow label="Bio"><TextInput value={member.bio} onChange={(v) => {
                    const next = members.map((entry, j) => j === i ? { ...entry, bio: v } : entry);
                    setProps({ members: next });
                  }} /></FieldRow>
                  <FieldRow label="Avatar URL"><TextInput value={member.avatar} onChange={(v) => {
                    const next = members.map((entry, j) => j === i ? { ...entry, avatar: v } : entry);
                    setProps({ members: next });
                  }} /></FieldRow>
                  <button type="button" onClick={() => setProps({ members: members.filter((_, j) => j !== i) })}
                    className="mt-1 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-0.5 text-xs text-red-400">
                    Remove
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        {node.type === 'navbar' && (
          <>
            <FieldRow label="Brand">
              <TextInput value={p.brand as string ?? ''} onChange={(v) => setProps({ brand: v })} />
            </FieldRow>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Nav Links</span>
              <button
                type="button"
                className="cursor-pointer rounded-md border border-slate-700 bg-transparent px-2 py-0.5 text-xs text-slate-400"
                onClick={() => setProps({ links: [...((p.links as string[]) ?? []), 'New Link'] })}
              >+ Add</button>
            </div>
            {((p.links as string[]) ?? []).map((link, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-1.5">
                <TextInput value={link} onChange={(v) => {
                  const next = (p.links as string[]).map((l, j) => j === i ? v : l);
                  setProps({ links: next });
                }} />
                <button type="button" onClick={() => setProps({ links: (p.links as string[]).filter((_, j) => j !== i) })}
                  className="shrink-0 cursor-pointer rounded border border-red-950 bg-transparent px-2 py-1 text-xs text-red-400">×</button>
              </div>
            ))}
          </>
        )}
        </CollapsibleSection>
        )}

        {!['heading', 'paragraph', 'label', 'list', 'link', 'html-element', 'html-container', 'badge', 'button', 'input', 'textarea', 'select', 'image', 'icon', 'navbar', 'hero', 'footer', 'video', 'testimonial', 'feature-grid', 'faq', 'pricing-table', 'cta-banner', 'stats-strip', 'tabs', 'accordion', 'timeline', 'carousel', 'comparison-table', 'team-grid'].includes(node.type) && (
          <p className="px-0 py-2 text-center text-[0.8125rem] text-slate-500">
            No content properties for this element.
          </p>
        )}
      </CollapsibleSection>

      {/* Universal styles */}
      {sectionMatches('colors', 'appearance', 'background', 'text color', 'gradient', 'padding', 'radius', 'opacity') && (
      <CollapsibleSection title="Colors & Appearance" defaultOpen={true}>
        <div className="mb-2">
          <div className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">
            Token Swatches <span className="font-normal text-slate-600">· click to apply bg · right-click to edit</span>
          </div>
          <DesignTokenPicker onApply={(v) => setStyles({ backgroundColor: v })} />
        </div>
        <div className="mb-2 rounded-md border border-slate-800 bg-slate-950/60 p-2">
          <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-slate-500">Theme Tokens</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStyles({ backgroundColor: themeVar.surface })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              BG Surface
            </button>
            <button
              type="button"
              onClick={() => setStyles({ backgroundColor: themeVar.primary, color: themeVar.onPrimary })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              BG Primary
            </button>
            <button
              type="button"
              onClick={() => setStyles({ color: themeVar.text })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setStyles({ borderColor: themeVar.border })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              Border
            </button>
            <button
              type="button"
              onClick={() => setStyles({ backgroundImage: themeVar.brandGradient })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
            >
              Gradient
            </button>
          </div>
        </div>
        <FieldRow label="Background Color" action={combinedFieldAction('backgroundColor', themeVar.surface)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'backgroundColor')}>
          <ColorInput value={(s.backgroundColor as string) ?? ''} onChange={(v) => setStyles({ backgroundColor: v })} />
        </FieldRow>
        <FieldRow label="Text Color" action={combinedFieldAction('color', themeVar.text)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'color')}>
          <ColorInput value={(s.color as string) ?? ''} onChange={(v) => setStyles({ color: v })} />
        </FieldRow>
        <FieldRow label="Background Gradient" action={combinedFieldAction('backgroundImage', themeVar.brandGradient)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'backgroundImage')}>
          <TextInput
            value={(s.backgroundImage as string) ?? ''}
            onChange={(v) => setStyles({ backgroundImage: v })}
            placeholder="e.g. linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)"
          />
        </FieldRow>
        <div className="-mt-0.5 flex flex-wrap gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setStyles({ backgroundImage: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' })}
            className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
          >
            Ocean
          </button>
          <button
            type="button"
            onClick={() => setStyles({ backgroundImage: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' })}
            className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
          >
            Sunset
          </button>
          <button
            type="button"
            onClick={() => setStyles({ backgroundImage: 'radial-gradient(circle at top, #34d399 0%, #0f172a 65%)' })}
            className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
          >
            Radial
          </button>
          <button
            type="button"
            onClick={() => setStyles({ backgroundImage: '' })}
            className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
          >
            Clear
          </button>
        </div>
      <FieldRow label="Padding" action={combinedFieldAction('padding', theme.spacing.md)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'padding')}>
        <TextInput value={(s.padding as string) ?? ''} onChange={(v) => setStyles({ padding: v })} placeholder="e.g. 24px" />
      </FieldRow>
      {spacingTokenEntries.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1.5 pb-1">
          {spacingTokenEntries.map(([key, value]) => (
            <button
              key={`padding-token-${key}`}
              type="button"
              onClick={() => setStyles({ padding: value })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
              title={`Set padding to ${value}`}
            >
              {key}: {value}
            </button>
          ))}
        </div>
      )}
      <FieldRow label="Border Radius" action={combinedFieldAction('borderRadius', theme.borderRadius.md)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'borderRadius')}>
        <TextInput value={(s.borderRadius as string) ?? ''} onChange={(v) => setStyles({ borderRadius: v })} placeholder="e.g. 8px" />
      </FieldRow>
      {radiusTokenEntries.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1.5 pb-1">
          {radiusTokenEntries.map(([key, value]) => (
            <button
              key={`radius-token-${key}`}
              type="button"
              onClick={() => setStyles({ borderRadius: value })}
              className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
              title={`Set border radius to ${value}`}
            >
              {key}: {value}
            </button>
          ))}
        </div>
      )}
      <FieldRow label="Font Size" action={combinedFieldAction('fontSize', theme.typography.baseFontSize)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'fontSize')}>
        <TextInput value={(s.fontSize as string) ?? ''} onChange={(v) => setStyles({ fontSize: v })} placeholder="e.g. 1rem" />
      </FieldRow>
      <FieldRow label="Font Weight" action={resetAction('fontWeight')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'fontWeight')}>
        <select value={(s.fontWeight as string) ?? ''} onChange={(e) => setStyles({ fontWeight: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['400', '500', '600', '700', '800', '900'].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Width" action={resetAction('width')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'width')}>
        <TextInput value={(s.width as string) ?? ''} onChange={(v) => setStyles({ width: v })} placeholder="e.g. 100%" />
      </FieldRow>
      <FieldRow label="Height" action={resetAction('height')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'height')}>
        <TextInput value={(s.height as string) ?? ''} onChange={(v) => setStyles({ height: v })} placeholder="e.g. 200px" />
      </FieldRow>
      <FieldRow label="Margin" action={resetAction('margin')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'margin')}>
        <TextInput value={(s.margin as string) ?? ''} onChange={(v) => setStyles({ margin: v })} placeholder="e.g. 0 auto" />
      </FieldRow>
      <FieldRow label="Opacity" action={resetAction('opacity')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'opacity')}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.opacity !== undefined ? Number(s.opacity) : 1}
          onChange={(e) => setStyles({ opacity: e.target.value })}
          className="w-full"
        />
      </FieldRow>

      {/* Flex/Layout properties */}
      </CollapsibleSection>
      )}
      {sectionMatches('layout', 'display', 'grid', 'flex', 'gap', 'align', 'justify', 'overflow') && (
      <CollapsibleSection title="Layout" defaultOpen={false}>
        <FieldRow label="Display" action={resetAction('display')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'display')}>
        <select value={(s.display as string) ?? ''} onChange={(e) => setStyles({ display: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['block', 'flex', 'grid', 'inline', 'inline-block', 'none'].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </FieldRow>

      {(s.display === 'flex' || s.display === 'flex-row' || s.display === 'flex-col') && (
        <>
          <FieldRow label="Flex Direction" action={resetAction('flexDirection')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'flexDirection')}>
            <select value={(s.flexDirection as string) ?? 'row'} onChange={(e) => setStyles({ flexDirection: e.target.value })} className={selectClass}>
              {['row', 'column', 'row-reverse', 'column-reverse'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Gap" action={resetAction('gap')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'gap')}>
            <TextInput value={(s.gap as string) ?? ''} onChange={(v) => setStyles({ gap: v })} placeholder="e.g. 16px" />
          </FieldRow>
          {spacingTokenEntries.length > 0 && (
            <div className="-mt-1 flex flex-wrap gap-1.5 pb-1">
              {spacingTokenEntries.map(([key, value]) => (
                <button
                  key={`gap-token-${key}`}
                  type="button"
                  onClick={() => setStyles({ gap: value })}
                  className="cursor-pointer rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300"
                  title={`Set gap to ${value}`}
                >
                  {key}: {value}
                </button>
              ))}
            </div>
          )}
          <FieldRow label="Justify Content" action={resetAction('justifyContent')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'justifyContent')}>
            <select value={(s.justifyContent as string) ?? ''} onChange={(e) => setStyles({ justifyContent: e.target.value })} className={selectClass}>
              <option value="">Default</option>
              {['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'].map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Align Items" action={resetAction('alignItems')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'alignItems')}>
            <select value={(s.alignItems as string) ?? ''} onChange={(e) => setStyles({ alignItems: e.target.value })} className={selectClass}>
              <option value="">Default</option>
              {['flex-start', 'center', 'flex-end', 'stretch', 'baseline'].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </FieldRow>
        </>
      )}

      {s.display === 'grid' && (
        <>
          <FieldRow label="Grid Cols" action={resetAction('gridTemplateColumns')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'gridTemplateColumns')}>
            <TextInput value={(s.gridTemplateColumns as string) ?? ''} onChange={(v) => setStyles({ gridTemplateColumns: v })} placeholder="e.g. 1fr 1fr" />
          </FieldRow>
          <FieldRow label="Grid Gap" action={resetAction('gap')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'gap')}>
            <TextInput value={(s.gap as string) ?? ''} onChange={(v) => setStyles({ gap: v })} placeholder="e.g. 16px" />
          </FieldRow>
        </>
      )}

      <FieldRow label="Overflow" action={resetAction('overflow')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'overflow')}>
        <select value={(s.overflow as string) ?? ''} onChange={(e) => setStyles({ overflow: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['visible', 'hidden', 'scroll', 'auto', 'clip'].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </FieldRow>

      {/* Border and Effects */}
      </CollapsibleSection>
      )}
      {sectionMatches('border', 'shadow', 'effects') && (
      <CollapsibleSection title="Borders & Effects" defaultOpen={false}>
        <FieldRow label="Border" action={resetAction('border')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'border')}>
        <TextInput value={(s.border as string) ?? ''} onChange={(v) => setStyles({ border: v })} placeholder="e.g. 1px solid #ccc" />
      </FieldRow>
      <FieldRow label="Border Color" action={combinedFieldAction('borderColor', themeVar.border)} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'borderColor')}>
        <ColorInput value={(s.borderColor as string) ?? ''} onChange={(v) => setStyles({ borderColor: v })} />
      </FieldRow>
      <FieldRow label="Box Shadow" action={resetAction('boxShadow')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'boxShadow')}>
        <TextInput value={(s.boxShadow as string) ?? ''} onChange={(v) => setStyles({ boxShadow: v })} placeholder="e.g. 0 4px 8px rgba(0,0,0,0.1)" />
      </FieldRow>

      {/* Dimension limits */}
      </CollapsibleSection>
      )}
      {sectionMatches('size', 'sizing', 'width', 'height', 'constraint', 'min', 'max') && (
      <CollapsibleSection title="Sizing & Constraints" defaultOpen={false}>
        <FieldRow label="Min Width" action={resetAction('minWidth')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'minWidth')}>
        <TextInput value={(s.minWidth as string) ?? ''} onChange={(v) => setStyles({ minWidth: v })} placeholder="e.g. 100px" />
      </FieldRow>
      <FieldRow label="Max Width" action={resetAction('maxWidth')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'maxWidth')}>
        <TextInput value={(s.maxWidth as string) ?? ''} onChange={(v) => setStyles({ maxWidth: v })} placeholder="e.g. 1200px" />
      </FieldRow>
      <FieldRow label="Min Height" action={resetAction('minHeight')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'minHeight')}>
        <TextInput value={(s.minHeight as string) ?? ''} onChange={(v) => setStyles({ minHeight: v })} placeholder="e.g. 100px" />
      </FieldRow>
      <FieldRow label="Max Height" action={resetAction('maxHeight')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'maxHeight')}>
        <TextInput value={(s.maxHeight as string) ?? ''} onChange={(v) => setStyles({ maxHeight: v })} placeholder="e.g. 500px" />
      </FieldRow>

      {/* Positioning */}
      </CollapsibleSection>
      )}
      {sectionMatches('position', 'z-index', 'z index', 'top', 'left', 'sticky', 'absolute') && (
      <CollapsibleSection title="Position" defaultOpen={false}>
        <FieldRow label="Position" action={resetAction('position')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'position')}>
        <select value={(s.position as string) ?? ''} onChange={(e) => setStyles({ position: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['static', 'relative', 'absolute', 'fixed', 'sticky'].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Z-Index" action={resetAction('zIndex')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'zIndex')}>
        <TextInput value={(s.zIndex as string) ?? ''} onChange={(v) => setStyles({ zIndex: v })} placeholder="e.g. 10" />
      </FieldRow>

      {/* Text properties */}
      </CollapsibleSection>
      )}
      {sectionMatches('typography', 'font', 'text', 'line height', 'letter spacing', 'white space') && (
      <CollapsibleSection title="Typography" defaultOpen={false}>
        <FieldRow label="Font Family" action={resetAction('fontFamily')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'fontFamily')}>
          <select value={(s.fontFamily as string) ?? ''} onChange={(e) => setStyles({ fontFamily: e.target.value })} className={selectClass}>
            <option value="">Default</option>
            <option value="Inter, sans-serif">Inter</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="Poppins, sans-serif">Poppins</option>
            <option value="'Playfair Display', serif">Playfair Display</option>
            <option value="'DM Sans', sans-serif">DM Sans</option>
            <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="monospace">Monospace</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="serif">Serif</option>
          </select>
        </FieldRow>
        <FieldRow label="Text Align" action={resetAction('textAlign')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'textAlign')}>
        <select value={(s.textAlign as string) ?? ''} onChange={(e) => setStyles({ textAlign: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['left', 'center', 'right', 'justify'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Line Height" action={resetAction('lineHeight')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'lineHeight')}>
        <TextInput value={(s.lineHeight as string) ?? ''} onChange={(v) => setStyles({ lineHeight: v })} placeholder="e.g. 1.5" />
      </FieldRow>
      <FieldRow label="Letter Spacing" action={resetAction('letterSpacing')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'letterSpacing')}>
        <TextInput value={(s.letterSpacing as string) ?? ''} onChange={(v) => setStyles({ letterSpacing: v })} placeholder="e.g. 0.05em" />
      </FieldRow>
      <FieldRow label="Text Decoration" action={resetAction('textDecoration')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'textDecoration')}>
        <select value={(s.textDecoration as string) ?? ''} onChange={(e) => setStyles({ textDecoration: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['none', 'underline', 'line-through', 'overline'].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Text Transform" action={resetAction('textTransform')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'textTransform')}>
        <select value={(s.textTransform as string) ?? ''} onChange={(e) => setStyles({ textTransform: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['none', 'uppercase', 'lowercase', 'capitalize'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="White Space" action={resetAction('whiteSpace')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'whiteSpace')}>
        <select value={(s.whiteSpace as string) ?? ''} onChange={(e) => setStyles({ whiteSpace: e.target.value })} className={selectClass}>
          <option value="">Default</option>
          {['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line'].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </FieldRow>
      </CollapsibleSection>
      )}
      {sectionMatches('transform', 'transition', 'cursor', 'advanced', 'filter', 'backdrop', 'blend', 'pointer events', 'custom css') && (
      <CollapsibleSection title="Transform & Transition" defaultOpen={false}>
        <FieldRow label="Transform" action={resetAction('transform')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'transform')}>
          <TextInput value={(s.transform as string) ?? ''} onChange={(v) => setStyles({ transform: v })} placeholder="e.g. scale(1.05) rotate(3deg)" />
        </FieldRow>
        <FieldRow label="Transition" action={resetAction('transition')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'transition')}>
          <TextInput value={(s.transition as string) ?? ''} onChange={(v) => setStyles({ transition: v })} placeholder="e.g. all 0.3s ease" />
        </FieldRow>
        <FieldRow label="Cursor" action={resetAction('cursor')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'cursor')}>
          <select value={(s.cursor as string) ?? ''} onChange={(e) => setStyles({ cursor: e.target.value })} className={selectClass}>
            <option value="">Default</option>
            {['auto', 'pointer', 'default', 'not-allowed', 'grab', 'grabbing', 'text', 'crosshair', 'zoom-in', 'zoom-out', 'none'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Filter" action={resetAction('filter')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'filter')}>
          <TextInput value={(s.filter as string) ?? ''} onChange={(v) => setStyles({ filter: v })} placeholder="e.g. blur(8px) saturate(120%)" />
        </FieldRow>
        <FieldRow label="Backdrop Filter" action={resetAction('backdropFilter')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'backdropFilter')}>
          <TextInput value={(s.backdropFilter as string) ?? ''} onChange={(v) => setStyles({ backdropFilter: v })} placeholder="e.g. blur(14px)" />
        </FieldRow>
        <FieldRow label="Blend Mode" action={resetAction('mixBlendMode')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'mixBlendMode')}>
          <select value={(s.mixBlendMode as string) ?? ''} onChange={(e) => setStyles({ mixBlendMode: e.target.value })} className={selectClass}>
            <option value="">Default</option>
            {['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Pointer Events" action={resetAction('pointerEvents')} hasOverride={Object.prototype.hasOwnProperty.call(bpOverrides, 'pointerEvents')}>
          <select value={(s.pointerEvents as string) ?? ''} onChange={(e) => setStyles({ pointerEvents: e.target.value })} className={selectClass}>
            <option value="">Default</option>
            <option value="auto">auto</option>
            <option value="none">none</option>
          </select>
        </FieldRow>
        <FieldRow label="Add Custom CSS Property">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={customStyleKey}
              onChange={(e) => setCustomStyleKey(e.target.value)}
              placeholder="property (e.g. clipPath)"
              className={`${textInputClass} min-w-0 flex-1`}
            />
            <input
              type="text"
              value={customStyleValue}
              onChange={(e) => setCustomStyleValue(e.target.value)}
              placeholder="value"
              className={`${textInputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={() => {
                const key = customStyleKey.trim();
                if (!key) return;
                setStyles({ [key]: customStyleValue });
                setCustomStyleKey('');
                setCustomStyleValue('');
              }}
              className="cursor-pointer rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300"
            >
              Add
            </button>
          </div>
        </FieldRow>
      </CollapsibleSection>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const actionBtnClass = 'flex-1 rounded-md border border-slate-800 bg-transparent px-3 py-1.5 text-[0.8125rem] text-slate-400 cursor-pointer';
const selectClass = textInputClass;
const miniResetBtnClass = 'cursor-pointer rounded-full border border-cyan-700 bg-cyan-950 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.04em] text-cyan-300';
const miniThemeBtnClass = 'cursor-pointer rounded-full border border-violet-700 bg-violet-950 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.04em] text-violet-300';

function hasCustomColorOverrides(nodes: EditorNode[]): boolean {
  const colorKeys = new Set(['color', 'backgroundColor', 'border', 'borderColor', 'backgroundImage']);
  const breakpointKeys = new Set(['desktop', 'tablet', 'mobile']);

  const checkStyles = (styles: Record<string, unknown>): boolean => {
    for (const [key, value] of Object.entries(styles ?? {})) {
      if (typeof value === 'object' && value !== null && breakpointKeys.has(key) && checkStyles(value as Record<string, unknown>)) {
        return true;
      }
      if (typeof value !== 'string' || !colorKeys.has(key)) continue;
      if (!value.includes('var(--sb-')) return true;
    }
    return false;
  };

  const walk = (tree: EditorNode[]): boolean => {
    for (const node of tree) {
      if (checkStyles(node.styles)) return true;
      if (walk(node.children)) return true;
    }
    return false;
  };

  return walk(nodes);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const { selectedNodeId, getNode, theme, setTheme, pageTree, applyThemeTokensToAllNodes } = useEditorStore();
  const themeFamilies = useMemo(() => getThemeFamilies(), []);
  const themeFamilyId = resolveThemeFamilyId(theme);
  const themeMode = resolveThemeMode(theme);

  const node = selectedNodeId ? getNode(selectedNodeId) : null;

  const applyThemeFamilyMode = (familyId: string, mode: ThemeMode) => {
    const hasOverrides = hasCustomColorOverrides(pageTree);
    let shouldRetokenize = false;

    if (hasOverrides) {
      const continueApply = window.confirm(
        'This page contains custom colors and gradients. Switching theme family or mode will not override those values automatically. Continue?'
      );
      if (!continueApply) return;

      shouldRetokenize = window.confirm(
        'Apply selected theme tokens to existing element colors now? This rewires color/background/border/gradient fields to CSS variables.'
      );
    }

    setTheme(getThemeForFamilyMode(familyId, mode));

    if (shouldRetokenize) {
      applyThemeTokensToAllNodes();
      toast('Theme applied and existing colors converted to theme tokens');
      return;
    }

    toast('Theme mode updated');
  };

  return (
    <div className="right-panel properties-panel flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 pb-2.5 pt-3.5 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-slate-600">
        {node ? `Properties — ${node.type}` : 'Properties'}
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto p-4">
        {selectedNodeId ? (
          <PropsSection nodeId={selectedNodeId} />
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-500">
              Select an element on the canvas to edit its properties, or edit site-level theme colors below.
            </p>
            <CollapsibleSection title="Site Theme" defaultOpen={true}>
              <div className="space-y-2">
                <FieldRow label="Theme Family">
                  <select
                    value={themeFamilyId}
                    onChange={(e) => applyThemeFamilyMode(e.target.value, themeMode)}
                    className={selectClass}
                  >
                    {themeFamilies.map((family) => (
                      <option key={family.id} value={family.id}>{family.label}</option>
                    ))}
                  </select>
                </FieldRow>
                <FieldRow label="Mode">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => applyThemeFamilyMode(themeFamilyId, 'light')}
                      className={`rounded-md border px-3 py-1.5 text-xs ${themeMode === 'light' ? 'border-amber-400 bg-amber-500/10 text-amber-200' : 'border-slate-700 text-slate-400'}`}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => applyThemeFamilyMode(themeFamilyId, 'dark')}
                      className={`rounded-md border px-3 py-1.5 text-xs ${themeMode === 'dark' ? 'border-cyan-400 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`}
                    >
                      Dark
                    </button>
                  </div>
                </FieldRow>
                <FieldRow label="Theme Name">
                  <TextInput value={theme.name} onChange={(v) => setTheme({ ...theme, name: v || 'Custom Theme' })} placeholder="Custom Theme" />
                </FieldRow>
                <FieldRow label="Background Color">
                  <ColorInput
                    value={theme.colors.background}
                    onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, background: v } })}
                  />
                </FieldRow>
                <FieldRow label="Surface Color">
                  <ColorInput
                    value={theme.colors.surface}
                    onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, surface: v } })}
                  />
                </FieldRow>
                <FieldRow label="Text Color">
                  <ColorInput
                    value={theme.colors.text}
                    onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, text: v } })}
                  />
                </FieldRow>
                <FieldRow label="Primary Color">
                  <ColorInput
                    value={theme.colors.primary}
                    onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, primary: v } })}
                  />
                </FieldRow>
                <FieldRow label="Secondary Color">
                  <ColorInput
                    value={theme.colors.secondary}
                    onChange={(v) => setTheme({ ...theme, colors: { ...theme.colors, secondary: v } })}
                  />
                </FieldRow>
                <FieldRow label="Base Font Family">
                  <TextInput
                    value={theme.typography.fontFamily}
                    onChange={(v) => setTheme({ ...theme, typography: { ...theme.typography, fontFamily: v } })}
                    placeholder="Inter, sans-serif"
                  />
                </FieldRow>
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    </div>
  );
}

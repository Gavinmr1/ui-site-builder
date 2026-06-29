import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Breakpoint, EditorNode } from '../types';
import { useEditorStore } from '../store/editorStore';
import { resolveResponsiveStyles } from '../utils/responsiveStyles';
import { Icon, type IconName } from '../components/Icon';

const INLINE_EDITABLE_TYPES = new Set(['heading', 'paragraph', 'label', 'badge', 'button', 'hero', 'footer', 'link', 'html-element']);
const CONTAINER_TYPES = new Set(['section', 'container', 'html-container', 'flex-row', 'flex-col', 'grid', 'hero']);
const SAFE_TEXT_TAGS: Array<keyof React.JSX.IntrinsicElements> = ['span', 'strong', 'em', 'small', 'mark', 'code', 'div', 'p', 'blockquote', 'pre', 'sup', 'sub', 'time'];
const SAFE_CONTAINER_TAGS: Array<keyof React.JSX.IntrinsicElements> = ['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'form', 'figure', 'figcaption'];

function canInlineEdit(type: string): boolean {
  return INLINE_EDITABLE_TYPES.has(type);
}

function findNodeMeta(
  nodes: EditorNode[],
  id: string,
  parentId: string | null = null
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const current = nodes[i];
    if (current.id === id) return { parentId, index: i };
    const found = findNodeMeta(current.children, id, current.id);
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

// ─── Individual Component Renders ────────────────────────────────────────────

function InlineEditableText({
  tag,
  value,
  style,
  isEditing,
  multiline = false,
  onStartEditing,
  onStopEditing,
  onCommit,
}: {
  tag: keyof React.JSX.IntrinsicElements;
  value: string;
  style?: React.CSSProperties;
  isEditing: boolean;
  multiline?: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onCommit: (value: string) => void;
}) {
  const Tag = tag;

  if (!isEditing) {
    return (
      <Tag
        style={style}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartEditing();
        }}
      >
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      style={style}
      contentEditable
      suppressContentEditableWarning
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        onCommit((e.currentTarget.textContent ?? '').replace(/\u00a0/g, ' '));
        onStopEditing();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onStopEditing();
          (e.currentTarget as HTMLElement).blur();
          return;
        }

        if (!multiline && e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {value}
    </Tag>
  );
}

function HeadingRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  const isNodeLocked = useEditorStore((s) => s.isNodeLocked);
  const locked = isNodeLocked(node.id);
  const level = (node.props.level as number) ?? 2;
  const tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return (
    <InlineEditableText
      tag={tag}
      value={(node.props.text as string) ?? ''}
      style={node.styles as React.CSSProperties}
      isEditing={isEditing && !locked}
      onStartEditing={() => {
        if (locked) return;
        startTextEditing(node.id);
      }}
      onStopEditing={stopTextEditing}
      onCommit={(text) => updateNodeProps(node.id, { text })}
    />
  );
}

function ParagraphRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  return (
    <InlineEditableText
      tag="p"
      value={(node.props.text as string) ?? ''}
      style={node.styles as React.CSSProperties}
      isEditing={isEditing}
      multiline
      onStartEditing={() => startTextEditing(node.id)}
      onStopEditing={stopTextEditing}
      onCommit={(text) => updateNodeProps(node.id, { text })}
    />
  );
}

function LabelRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  return (
    <InlineEditableText
      tag="span"
      value={(node.props.text as string) ?? ''}
      style={node.styles as React.CSSProperties}
      isEditing={isEditing}
      onStartEditing={() => startTextEditing(node.id)}
      onStopEditing={stopTextEditing}
      onCommit={(text) => updateNodeProps(node.id, { text })}
    />
  );
}

function ListRenderer({ node }: { node: EditorNode }) {
  const items = (node.props.items as string[]) ?? [];
  const ordered = !!node.props.ordered;
  const Tag = ordered ? 'ol' : 'ul';

  return (
    <Tag style={node.styles as React.CSSProperties}>
      {items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}
    </Tag>
  );
}

function LinkRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);

  return (
    <a
      href={(node.props.href as string) ?? '#'}
      target={(node.props.target as React.HTMLAttributeAnchorTarget) ?? '_blank'}
      rel="noreferrer"
      style={node.styles as React.CSSProperties}
      onClick={(e) => e.preventDefault()}
    >
      <InlineEditableText
        tag="span"
        value={(node.props.text as string) ?? 'Link'}
        style={{ color: 'inherit', textDecoration: 'inherit' }}
        isEditing={isEditing}
        onStartEditing={() => startTextEditing(node.id)}
        onStopEditing={stopTextEditing}
        onCommit={(text) => updateNodeProps(node.id, { text })}
      />
    </a>
  );
}

function HtmlElementRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  const tag = (node.props.tag as keyof React.JSX.IntrinsicElements) ?? 'span';
  const safeTag = SAFE_TEXT_TAGS.includes(tag) ? tag : 'span';

  return (
    <InlineEditableText
      tag={safeTag}
      value={(node.props.text as string) ?? ''}
      style={node.styles as React.CSSProperties}
      isEditing={isEditing}
      multiline={safeTag === 'div' || safeTag === 'p' || safeTag === 'blockquote' || safeTag === 'pre'}
      onStartEditing={() => startTextEditing(node.id)}
      onStopEditing={stopTextEditing}
      onCommit={(text) => updateNodeProps(node.id, { text })}
    />
  );
}

function HtmlContainerRenderer({ node, children }: { node: EditorNode; children: React.ReactNode }) {
  const tag = (node.props.tag as keyof React.JSX.IntrinsicElements) ?? 'div';
  const safeTag = SAFE_CONTAINER_TAGS.includes(tag) ? tag : 'div';
  return React.createElement(safeTag, { style: node.styles as React.CSSProperties }, children);
}

function SvgIconRenderer({ node }: { node: EditorNode }) {
  return (
    <span style={node.styles as React.CSSProperties} role="img" aria-label={(node.props.ariaLabel as string) ?? 'Icon'}>
      <Icon
        name={((node.props.iconName as IconName) ?? 'sparkles')}
        size={Number(node.props.size ?? 28)}
        strokeWidth={Number(node.props.strokeWidth ?? 2)}
      />
    </span>
  );
}

function BadgeRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  return (
    <InlineEditableText
      tag="span"
      value={(node.props.text as string) ?? ''}
      style={node.styles as React.CSSProperties}
      isEditing={isEditing}
      onStartEditing={() => startTextEditing(node.id)}
      onStopEditing={stopTextEditing}
      onCommit={(text) => updateNodeProps(node.id, { text })}
    />
  );
}

function ButtonRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);

  if (!isEditing) {
    return (
      <button
        type="button"
        style={node.styles as React.CSSProperties}
        onDoubleClick={(e) => {
          e.stopPropagation();
          startTextEditing(node.id);
        }}
      >
        {(node.props.text as string) ?? ''}
      </button>
    );
  }

  return (
    <button
      type="button"
      style={node.styles as React.CSSProperties}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        updateNodeProps(node.id, { text: e.currentTarget.textContent ?? '' });
        stopTextEditing();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          stopTextEditing();
          (e.currentTarget as HTMLElement).blur();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {(node.props.text as string) ?? ''}
    </button>
  );
}

function InputRenderer({ node }: { node: EditorNode }) {
  return (
    <input
      type={(node.props.type as string) ?? 'text'}
      name={(node.props.name as string) ?? undefined}
      aria-label={(node.props.ariaLabel as string) ?? 'Text input'}
      placeholder={node.props.placeholder as string}
      style={node.styles as React.CSSProperties}
      readOnly
    />
  );
}

function TextareaRenderer({ node }: { node: EditorNode }) {
  return (
    <textarea
      name={(node.props.name as string) ?? undefined}
      aria-label={(node.props.ariaLabel as string) ?? 'Text area'}
      placeholder={(node.props.placeholder as string) ?? ''}
      rows={Number(node.props.rows ?? 5)}
      defaultValue={(node.props.value as string) ?? ''}
      style={node.styles as React.CSSProperties}
      readOnly
    />
  );
}

function SelectRenderer({ node }: { node: EditorNode }) {
  const options = ((node.props.options as string[]) ?? []).filter(Boolean);
  const selectedValue = String(node.props.value ?? options[0] ?? '');

  return (
    <select
      name={(node.props.name as string) ?? undefined}
      aria-label={(node.props.ariaLabel as string) ?? 'Select input'}
      value={selectedValue}
      style={node.styles as React.CSSProperties}
      onChange={() => undefined}
    >
      {options.map((option) => {
        const optionValue = option.toLowerCase().replace(/\s+/g, '-');
        return (
          <option key={optionValue} value={optionValue}>
            {option}
          </option>
        );
      })}
    </select>
  );
}

function NavbarRenderer({ node }: { node: EditorNode }) {
  const links = (node.props.links as string[]) ?? [];
  return (
    <nav style={node.styles as React.CSSProperties}>
      <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>
        {node.props.brand as string}
      </span>
      <div style={{ display: 'flex', gap: '24px' }}>
        {links.map((link, i) => (
          <span key={i} style={{ cursor: 'pointer', fontSize: '0.9375rem' }}>
            {link}
          </span>
        ))}
      </div>
    </nav>
  );
}

function ImageRenderer({ node }: { node: EditorNode }) {
  return (
    <img
      src={node.props.src as string}
      alt={(node.props.alt as string) ?? ''}
      style={{ objectFit: (node.props.objectFit as React.CSSProperties['objectFit']) ?? 'cover', ...(node.styles as React.CSSProperties) }}
    />
  );
}

function VideoRenderer({ node }: { node: EditorNode }) {
  return (
    <video
      src={node.props.src as string}
      poster={node.props.poster as string}
      controls={node.props.controls as boolean}
      style={node.styles as React.CSSProperties}
    />
  );
}

function HeroRenderer({
  node,
  children,
  isEditing,
}: {
  node: EditorNode;
  children: React.ReactNode;
  isEditing: boolean;
}) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  return (
    <div style={node.styles as React.CSSProperties}>
      <InlineEditableText
        tag="h1"
        value={(node.props.title as string) ?? ''}
        isEditing={isEditing}
        onStartEditing={() => startTextEditing(node.id)}
        onStopEditing={stopTextEditing}
        onCommit={(title) => updateNodeProps(node.id, { title })}
        style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '16px', lineHeight: 1.1 }}
      />
      <InlineEditableText
        tag="p"
        value={(node.props.subtitle as string) ?? ''}
        isEditing={isEditing}
        multiline
        onStartEditing={() => startTextEditing(node.id)}
        onStopEditing={stopTextEditing}
        onCommit={(subtitle) => updateNodeProps(node.id, { subtitle })}
        style={{ fontSize: '1.25rem', marginBottom: '40px', opacity: 0.8, maxWidth: '600px' }}
      />
      {!!node.props.ctaText && (
        <button
          type="button"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            startTextEditing(node.id);
          }}
          onBlur={(e) => {
            updateNodeProps(node.id, { ctaText: e.currentTarget.textContent ?? '' });
            stopTextEditing();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              stopTextEditing();
              (e.currentTarget as HTMLElement).blur();
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.currentTarget as HTMLElement).blur();
            }
          }}
          style={{
            padding: '14px 36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#6366f1',
            color: '#fff',
            fontSize: '1.0625rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {node.props.ctaText as string}
        </button>
      )}
      {children}
    </div>
  );
}

function FooterRenderer({ node, isEditing }: { node: EditorNode; isEditing: boolean }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const startTextEditing = useEditorStore((s) => s.startTextEditing);
  const stopTextEditing = useEditorStore((s) => s.stopTextEditing);
  return (
    <footer style={node.styles as React.CSSProperties}>
      <InlineEditableText
        tag="span"
        value={(node.props.copyright as string) ?? ''}
        isEditing={isEditing}
        onStartEditing={() => startTextEditing(node.id)}
        onStopEditing={stopTextEditing}
        onCommit={(copyright) => updateNodeProps(node.id, { copyright })}
      />
    </footer>
  );
}

function FeatureGridRenderer({ node }: { node: EditorNode }) {
  const features = (node.props.features as Array<{ title: string; description: string }>) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {features.map((f, i) => (
        <div
          key={i}
          style={{
            padding: '32px',
            borderRadius: '12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
          }}
        >
          <h3 style={{ marginBottom: '8px', fontSize: '1.125rem', fontWeight: 700 }}>{f.title}</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>{f.description}</p>
        </div>
      ))}
    </div>
  );
}

function TestimonialRenderer({ node }: { node: EditorNode }) {
  return (
    <div style={node.styles as React.CSSProperties}>
      <p style={{ fontSize: '1.25rem', fontStyle: 'italic', marginBottom: '24px' }}>
        "{node.props.quote as string}"
      </p>
      <p style={{ fontWeight: 700 }}>{node.props.author as string}</p>
      <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{node.props.role as string}</p>
    </div>
  );
}

function SpacerRenderer({ node }: { node: EditorNode }) {
  return <div style={node.styles as React.CSSProperties} />;
}

function PricingTableRenderer({ node }: { node: EditorNode }) {
  type Plan = { name: string; price: string; features: string[]; ctaText: string; highlighted?: boolean };
  const plans = (node.props.plans as Plan[]) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {plans.map((plan, i) => (
        <div
          key={i}
          style={{
            padding: '40px 32px',
            borderRadius: '16px',
            backgroundColor: plan.highlighted ? '#6366f1' : '#1e293b',
            border: plan.highlighted ? '2px solid #818cf8' : '1px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{plan.name}</h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{plan.price}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(plan.features ?? []).map((feature, j) => (
              <li key={j} style={{ color: plan.highlighted ? 'rgba(255,255,255,0.88)' : '#94a3b8', fontSize: '0.9375rem' }}>
                ✓ {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            style={{
              marginTop: 'auto',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: plan.highlighted ? '#fff' : '#6366f1',
              color: plan.highlighted ? '#6366f1' : '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {plan.ctaText}
          </button>
        </div>
      ))}
    </div>
  );
}

function FaqRenderer({ node }: { node: EditorNode }) {
  type QA = { q: string; a: string };
  const questions = (node.props.questions as QA[]) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {questions.map((item, i) => (
        <div
          key={i}
          style={{ borderBottom: '1px solid #334155', padding: '24px 0' }}
        >
          <h4 style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '1.0625rem' }}>{item.q}</h4>
          <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.6 }}>{item.a}</p>
        </div>
      ))}
    </div>
  );
}

function CtaBannerRenderer({ node }: { node: EditorNode }) {
  return (
    <div style={node.styles as React.CSSProperties}>
      {!!node.props.eyebrow && (
        <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.9 }}>
          {node.props.eyebrow as string}
        </p>
      )}
      <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, lineHeight: 1.15 }}>
        {node.props.title as string}
      </h2>
      <p style={{ margin: 0, maxWidth: '700px', fontSize: '1.0625rem', opacity: 0.92 }}>
        {node.props.subtitle as string}
      </p>
      <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
        <button
          type="button"
          style={{
            border: 'none',
            borderRadius: '10px',
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: '#ffffff',
            color: '#1e1b4b',
          }}
        >
          {node.props.primaryCta as string}
        </button>
        <button
          type="button"
          style={{
            border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: '10px',
            padding: '12px 20px',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#ffffff',
          }}
        >
          {node.props.secondaryCta as string}
        </button>
      </div>
    </div>
  );
}

function StatsStripRenderer({ node }: { node: EditorNode }) {
  const stats = (node.props.stats as Array<{ label: string; value: string; helper?: string }>) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            borderRadius: '12px',
            border: '1px solid #334155',
            backgroundColor: '#111827',
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '0.78125rem', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            {stat.label}
          </span>
          <strong style={{ fontSize: '1.75rem', lineHeight: 1.1, color: '#e2e8f0' }}>
            {stat.value}
          </strong>
          {!!stat.helper && (
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>{stat.helper}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function TabsRenderer({ node }: { node: EditorNode }) {
  const items = (node.props.items as Array<{ label: string; content: string }>) ?? [];
  const activeIndex = Number(node.props.activeIndex ?? 0);
  const maxIndex = Math.max(0, items.length - 1);
  const safeIndex = Math.max(0, Math.min(activeIndex, maxIndex));
  const [currentIndex, setCurrentIndex] = React.useState(safeIndex);

  React.useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(safeIndex, maxIndex)));
  }, [safeIndex, maxIndex]);

  const activeItem = items[currentIndex];

  return (
    <div style={node.styles as React.CSSProperties}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {items.map((item, i) => (
          <button
            key={`${item.label}-${i}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(i);
            }}
            style={{
              borderRadius: '9px',
              border: i === currentIndex ? '1px solid #818cf8' : '1px solid #334155',
              backgroundColor: i === currentIndex ? 'rgba(99,102,241,0.2)' : 'rgba(15,23,42,0.6)',
              color: i === currentIndex ? '#c7d2fe' : '#94a3b8',
              padding: '8px 12px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ border: '1px solid #334155', borderRadius: '10px', padding: '16px', backgroundColor: '#0b1220', color: '#cbd5e1', minHeight: '72px' }}>
        {activeItem?.content ?? ''}
      </div>
    </div>
  );
}

function AccordionRenderer({ node }: { node: EditorNode }) {
  const items = (node.props.items as Array<{ title: string; content: string }>) ?? [];
  const openIndex = Number(node.props.openIndex ?? 0);
  const maxIndex = Math.max(0, items.length - 1);
  const safeOpenIndex = Math.max(0, Math.min(openIndex, maxIndex));
  const [currentOpenIndex, setCurrentOpenIndex] = React.useState(safeOpenIndex);

  React.useEffect(() => {
    setCurrentOpenIndex(Math.max(0, Math.min(safeOpenIndex, maxIndex)));
  }, [safeOpenIndex, maxIndex]);

  return (
    <div style={node.styles as React.CSSProperties}>
      {items.map((item, i) => {
        const isOpen = i === currentOpenIndex;
        return (
          <div key={`${item.title}-${i}`} style={{ border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#0f172a' }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setCurrentOpenIndex((prev) => (prev === i ? -1 : i));
              }}
              style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.9375rem', color: '#e2e8f0', borderBottom: isOpen ? '1px solid #334155' : 'none', cursor: 'pointer' }}
            >
              {item.title}
            </div>
            {isOpen && (
              <div style={{ padding: '12px 14px', color: '#94a3b8', lineHeight: 1.55 }}>
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimelineRenderer({ node }: { node: EditorNode }) {
  const items = (node.props.items as Array<{ date: string; title: string; description: string }>) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {items.map((item, i) => (
        <div key={`${item.title}-${i}`} style={{ position: 'relative', paddingLeft: '22px', marginBottom: i === items.length - 1 ? '0' : '8px' }}>
          <span
            style={{
              position: 'absolute',
              left: '-8px',
              top: '6px',
              width: '12px',
              height: '12px',
              borderRadius: '999px',
              backgroundColor: '#6366f1',
              boxShadow: '0 0 0 3px rgba(99,102,241,0.25)',
            }}
          />
          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: 700 }}>
            {item.date}
          </p>
          <h4 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#e2e8f0' }}>{item.title}</h4>
          <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.55 }}>{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function CarouselRenderer({ node }: { node: EditorNode }) {
  const slides = (node.props.slides as Array<{ title: string; description: string; image: string }>) ?? [];
  const maxIndex = Math.max(0, slides.length - 1);
  const activeIndex = Number(node.props.activeIndex ?? 0);
  const safeIndex = Math.max(0, Math.min(activeIndex, maxIndex));
  const [currentIndex, setCurrentIndex] = React.useState(safeIndex);

  React.useEffect(() => {
    setCurrentIndex(Math.max(0, Math.min(safeIndex, maxIndex)));
  }, [safeIndex, maxIndex]);

  const current = slides[currentIndex];

  return (
    <div style={node.styles as React.CSSProperties}>
      {current && (
        <div style={{ position: 'relative', minHeight: '360px', display: 'flex', alignItems: 'end', backgroundColor: '#0f172a' }}>
          <img src={current.image} alt={current.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.68 }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', padding: '20px', background: 'linear-gradient(180deg, transparent 0%, rgba(2,6,23,0.8) 70%)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.5rem', color: '#f8fafc' }}>{current.title}</h3>
            <p style={{ margin: 0, color: '#cbd5e1', maxWidth: '680px' }}>{current.description}</p>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#020617' }}>
        <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentIndex((v) => (v - 1 + slides.length) % (slides.length || 1)); }} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '6px 10px', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>Prev</button>
        {slides.map((_, i) => (
          <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); }} style={{ width: '9px', height: '9px', borderRadius: '999px', border: 'none', backgroundColor: i === currentIndex ? '#6366f1' : '#475569', cursor: 'pointer' }} />
        ))}
        <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentIndex((v) => (v + 1) % (slides.length || 1)); }} style={{ border: '1px solid #334155', borderRadius: '8px', padding: '6px 10px', backgroundColor: 'transparent', color: '#cbd5e1', cursor: 'pointer' }}>Next</button>
      </div>
    </div>
  );
}

function ComparisonTableRenderer({ node }: { node: EditorNode }) {
  const columns = (node.props.columns as string[]) ?? [];
  const rows = (node.props.rows as Array<{ feature: string; values: string[] }>) ?? [];

  return (
    <div style={{ ...(node.styles as React.CSSProperties), overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature</th>
            {columns.map((col, i) => (
              <th key={`${col}-${i}`} style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #334155', color: '#e2e8f0' }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={`${row.feature}-${rowIdx}`}>
              <td style={{ padding: '12px', borderBottom: '1px solid #1e293b', color: '#cbd5e1', fontWeight: 600 }}>{row.feature}</td>
              {columns.map((_, colIdx) => (
                <td key={`c-${rowIdx}-${colIdx}`} style={{ padding: '12px', borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>{row.values[colIdx] ?? '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamGridRenderer({ node }: { node: EditorNode }) {
  const members = (node.props.members as Array<{ name: string; role: string; bio: string; avatar: string }>) ?? [];
  return (
    <div style={node.styles as React.CSSProperties}>
      {members.map((member, i) => (
        <article key={`${member.name}-${i}`} style={{ border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0b1220', color: '#e2e8f0' }}>
          <img src={member.avatar} alt={member.name} style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', backgroundColor: '#1e293b' }} />
          <div style={{ padding: '12px' }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{member.name}</h4>
            <p style={{ margin: '0 0 8px', color: '#93c5fd', fontSize: '0.875rem', fontWeight: 600 }}>{member.role}</p>
            <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.55, fontSize: '0.9rem' }}>{member.bio}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

// ─── Container Renderer (wraps children) ─────────────────────────────────────

function ContainerRenderer({ node, children }: { node: EditorNode; children: React.ReactNode }) {
  return <div style={node.styles as React.CSSProperties}>{children}</div>;
}

// ─── Main renderNode function ─────────────────────────────────────────────────

export function renderNode(
  node: EditorNode,
  isEditing = false,
  childrenOverride?: React.ReactNode,
  activeBreakpoint: Breakpoint = 'desktop'
): React.ReactNode {
  const resolvedNode: EditorNode = {
    ...node,
    styles: resolveResponsiveStyles(node.styles, activeBreakpoint) as EditorNode['styles'],
  };

  const children =
    childrenOverride ??
    node.children.map((child) => renderNode(child, isEditing, undefined, activeBreakpoint));

  switch (resolvedNode.type) {
    case 'heading':
      return <HeadingRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'paragraph':
      return <ParagraphRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'label':
      return <LabelRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'list':
      return <ListRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'link':
      return <LinkRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'html-element':
      return <HtmlElementRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'badge':
      return <BadgeRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'button':
      return <ButtonRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'input':
      return <InputRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'textarea':
      return <TextareaRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'select':
      return <SelectRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'navbar':
      return <NavbarRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'image':
      return <ImageRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'video':
      return <VideoRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'icon':
      return <SvgIconRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'hero':
      return (
        <HeroRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing}>
          {children}
        </HeroRenderer>
      );
    case 'footer':
      return <FooterRenderer key={resolvedNode.id} node={resolvedNode} isEditing={isEditing} />;
    case 'feature-grid':
      return <FeatureGridRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'testimonial':
      return <TestimonialRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'pricing-table':
      return <PricingTableRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'faq':
      return <FaqRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'cta-banner':
      return <CtaBannerRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'stats-strip':
      return <StatsStripRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'tabs':
      return <TabsRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'accordion':
      return <AccordionRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'timeline':
      return <TimelineRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'carousel':
      return <CarouselRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'comparison-table':
      return <ComparisonTableRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'team-grid':
      return <TeamGridRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'spacer':
      return <SpacerRenderer key={resolvedNode.id} node={resolvedNode} />;
    case 'html-container':
      return (
        <HtmlContainerRenderer key={resolvedNode.id} node={resolvedNode}>
          {children}
        </HtmlContainerRenderer>
      );
    case 'section':
    case 'container':
    case 'flex-row':
    case 'flex-col':
    case 'grid':
    default:
      return (
        <ContainerRenderer key={resolvedNode.id} node={resolvedNode}>
          {children}
        </ContainerRenderer>
      );
  }
}

// ─── Editor-aware node wrapper (adds selection/hover UI) ──────────────────────

export function EditorNodeWrapper({
  node,
  children,
}: {
  node: EditorNode;
  children: React.ReactNode;
}) {
  const {
    selectedNodeId,
    selectedNodeIds,
    hoveredNodeId,
    dropIndicator,
    activeBreakpoint,
    textEditingNodeId,
    nodeContextMenu,
    selectNode,
    toggleNodeSelection,
    hoverNode,
    stopTextEditing,
    startTextEditing,
    openNodeContextMenu,
    closeNodeContextMenu,
    copyNode,
    pasteNode,
    copyNodeStyles,
    pasteNodeStyles,
    styleClipboard,
    duplicateNode,
    removeNode,
    pageTree,
    moveNode,
    isNodeLocked,
    toggleNodeLocked,
    toggleNodeHidden,
  } = useEditorStore();
  const locked = isNodeLocked(node.id);
  const isTextEditing = textEditingNodeId === node.id;
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: node.id, disabled: isTextEditing || locked });
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: node.id, disabled: locked });

  const setNodeRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      setDraggableNodeRef(el);
      setDroppableNodeRef(el);
    },
    [setDraggableNodeRef, setDroppableNodeRef]
  );

  const isSelected = selectedNodeIds.includes(node.id);
  const isPrimarySelected = selectedNodeId === node.id;
  const isContextMenuOpen = nodeContextMenu?.nodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const canEditText = canInlineEdit(node.type);
  const indicatorPosition = dropIndicator?.targetId === node.id ? dropIndicator.position : null;
  const showInsideZone = indicatorPosition === 'inside';
  const breakpointOverrideCount = Object.keys(
    ((node.styles as Record<string, unknown>)[activeBreakpoint] as Record<string, unknown>) ?? {}
  ).length;
  const meta = findNodeMeta(pageTree, node.id);
  const siblings = meta ? getChildrenForParent(pageTree, meta.parentId) : [];
  const canMoveTop = !!meta && meta.index > 0 && !locked;
  const canMoveBottom = !!meta && meta.index < siblings.length - 1 && !locked;

  function pasteNearNode() {
    if (CONTAINER_TYPES.has(node.type)) {
      pasteNode(node.id);
      return;
    }

    const meta = findNodeMeta(pageTree, node.id);
    if (meta) {
      pasteNode(meta.parentId, meta.index + 1);
      return;
    }

    pasteNode(null);
  }

  return (
    <div
      ref={setNodeRef}
      className="sb-node-animated"
      data-node-id={node.id}
      {...(isTextEditing || locked ? {} : attributes)}
      {...(isTextEditing || locked ? {} : listeners)}
      onClick={(e) => {
        e.stopPropagation();
        if (!isTextEditing) {
          stopTextEditing();
        }
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          toggleNodeSelection(node.id);
          return;
        }
        selectNode(node.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openNodeContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        hoverNode(node.id);
      }}
      onMouseLeave={() => hoverNode(null)}
      style={{
        position: 'relative',
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        transition: isDragging
          ? 'opacity 120ms ease-out'
          : 'transform 140ms ease, opacity 120ms ease, box-shadow 160ms ease, outline-color 140ms ease',
        outline: isSelected
          ? '2px solid #6366f1'
          : isOver && !showInsideZone
          ? '2px dashed #22c55e'
          : isHovered
          ? '1px dashed #6366f1'
          : 'none',
        outlineOffset: '1px',
        boxShadow: isSelected && !isPrimarySelected ? '0 0 0 1px rgba(99,102,241,0.5) inset' : undefined,
        cursor: locked ? 'not-allowed' : isTextEditing ? 'text' : isDragging ? 'grabbing' : 'grab',
      }}
    >
      {indicatorPosition === 'before' && (
        <div
          className="sb-drop-indicator"
          style={{
            position: 'absolute',
            left: '-6px',
            right: '-6px',
            top: '-6px',
            height: '4px',
            backgroundColor: '#22c55e',
            borderRadius: '999px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.85), 0 0 14px rgba(34,197,94,0.45)',
            zIndex: 150,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '-3px',
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '-3px',
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '-24px',
              right: 0,
              backgroundColor: '#166534',
              color: '#f0fdf4',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            Insert before
          </div>
        </div>
      )}

      {children}

      {indicatorPosition === 'inside' && (
        <div
          className="sb-drop-indicator"
          style={{
            position: 'absolute',
            inset: '6px',
            border: '2px solid rgba(34,197,94,0.95)',
            background: 'rgba(34, 197, 94, 0.12)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6), 0 0 0 1px rgba(34,197,94,0.25)',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(22, 101, 52, 0.92)',
              color: '#f0fdf4',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            }}
          >
            Nest inside
          </div>
        </div>
      )}

      {indicatorPosition === 'after' && (
        <div
          className="sb-drop-indicator"
          style={{
            position: 'absolute',
            left: '-6px',
            right: '-6px',
            bottom: '-6px',
            height: '4px',
            backgroundColor: '#22c55e',
            borderRadius: '999px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.85), 0 0 14px rgba(34,197,94,0.45)',
            zIndex: 150,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '-3px',
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '-3px',
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: 0,
              backgroundColor: '#166534',
              color: '#f0fdf4',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '999px',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            Insert after
          </div>
        </div>
      )}

      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: 0,
            background: '#6366f1',
            color: '#fff',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '3px 3px 0 0',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          {node.type}
        </div>
      )}

      {isSelected && !isTextEditing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            zIndex: 180,
            backgroundColor: 'rgba(2,6,23,0.92)',
            border: '1px solid #334155',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px',
            backdropFilter: 'blur(3px)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.32)',
          }}
        >
          {canEditText && (
            <QuickActionButton
              title="Edit text (Double-click or Enter)"
              label="T"
              disabled={locked}
              onClick={() => startTextEditing(node.id)}
            />
          )}
          <QuickActionButton title="Copy node" label="C" onClick={() => copyNode(node.id)} />
          <QuickActionButton title="Paste near node" label="V" disabled={locked} onClick={pasteNearNode} />
          <QuickActionButton title="Duplicate node" label="D" disabled={locked} onClick={() => duplicateNode(node.id)} />
          <QuickActionButton
            title={locked ? 'Unlock node' : 'Lock node'}
            label={locked ? 'U' : 'L'}
            onClick={() => toggleNodeLocked(node.id)}
          />
          <QuickActionButton
            title="Hide node"
            label="H"
            onClick={() => toggleNodeHidden(node.id)}
          />
          <QuickActionButton
            title="Delete node"
            label="X"
            danger
            disabled={locked}
            onClick={() => removeNode(node.id)}
          />
        </div>
      )}

      {isSelected && canEditText && !isTextEditing && (
        <div
          style={{
            position: 'absolute',
            bottom: '-18px',
            left: '8px',
            zIndex: 110,
            pointerEvents: 'none',
            fontSize: '10px',
            color: '#bfdbfe',
            backgroundColor: 'rgba(30, 64, 175, 0.85)',
            border: '1px solid rgba(147,197,253,0.4)',
            borderRadius: '999px',
            padding: '2px 8px',
            whiteSpace: 'nowrap',
          }}
        >
          Double-click or press Enter to edit text
        </div>
      )}

      {breakpointOverrideCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            right: 0,
            background: '#0891b2',
            color: '#ecfeff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '3px 3px 0 0',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
          }}
          title={`${breakpointOverrideCount} responsive override${breakpointOverrideCount === 1 ? '' : 's'} on ${activeBreakpoint}`}
        >
          {activeBreakpoint}: {breakpointOverrideCount}
        </div>
      )}

      {isContextMenuOpen && nodeContextMenu && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${nodeContextMenu.y}px`,
            left: `${nodeContextMenu.x}px`,
            transform: 'translate(6px, 6px)',
            zIndex: 300,
            minWidth: '170px',
            backgroundColor: '#020617',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {canEditText && (
            <ContextMenuButton
              label="Edit text"
              disabled={locked}
              onClick={() => {
                startTextEditing(node.id);
                closeNodeContextMenu();
              }}
            />
          )}
          <ContextMenuButton
            label="Copy"
            onClick={() => {
              copyNode(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Paste here"
            disabled={locked}
            onClick={() => {
              pasteNearNode();
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Copy styles"
            onClick={() => {
              copyNodeStyles(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Paste styles"
            disabled={!styleClipboard || locked}
            onClick={() => {
              pasteNodeStyles(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Duplicate"
            disabled={locked}
            onClick={() => {
              duplicateNode(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Bring to top"
            disabled={!canMoveTop}
            onClick={() => {
              if (!meta) return;
              moveNode(node.id, meta.parentId, 0);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Send to bottom"
            disabled={!canMoveBottom}
            onClick={() => {
              if (!meta) return;
              moveNode(node.id, meta.parentId, siblings.length);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label={locked ? 'Unlock node' : 'Lock node'}
            onClick={() => {
              toggleNodeLocked(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Hide node"
            onClick={() => {
              toggleNodeHidden(node.id);
              closeNodeContextMenu();
            }}
          />
          <ContextMenuButton
            label="Delete"
            danger
            disabled={locked}
            onClick={() => {
              removeNode(node.id);
              closeNodeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuButton({
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        border: '1px solid transparent',
        background: 'transparent',
        color: disabled ? '#475569' : danger ? '#fca5a5' : '#cbd5e1',
        fontSize: '0.8125rem',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger ? '#450a0a' : '#1e293b';
        (e.currentTarget as HTMLButtonElement).style.borderColor = danger ? '#7f1d1d' : '#334155';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
      }}
    >
      {label}
    </button>
  );
}

function QuickActionButton({
  title,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  title: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '6px',
        border: `1px solid ${disabled ? '#1e293b' : danger ? '#7f1d1d' : '#334155'}`,
        backgroundColor: disabled ? '#020617' : danger ? '#450a0a' : '#0f172a',
        color: disabled ? '#475569' : danger ? '#fca5a5' : '#cbd5e1',
        fontSize: '11px',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

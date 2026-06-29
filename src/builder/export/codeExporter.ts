import JSZip from 'jszip';
import { useEditorStore } from '../store/editorStore';
import type { EditorNode, ThemeConfig } from '../types';
import { getThemeCssVarsCss, themeVar } from '../themes/themeTokens';
import { trackEvent } from '../analytics';

export interface ExportOptions {
  mode: 'react-zip' | 'html-file';
  includePackageJson: boolean;
  includeReadme: boolean;
  includeIndexCss: boolean;
}

const BREAKPOINT_KEYS = new Set(['desktop', 'tablet', 'mobile']);
const SAFE_TEXT_TAGS = new Set(['span', 'strong', 'em', 'small', 'mark', 'code', 'div', 'p', 'blockquote', 'pre', 'sup', 'sub', 'time']);
const SAFE_CONTAINER_TAGS = new Set(['div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'nav', 'form', 'figure', 'figcaption']);

function normalizeOptionValue(option: string): string {
  return option.toLowerCase().replace(/\s+/g, '-');
}

function getOptionList(node: EditorNode): string[] {
  return ((node.props.options as string[]) ?? []).map((option) => String(option).trim()).filter(Boolean);
}

function styleObjectToJsx(styles: Record<string, unknown>): string {
  const entries = Object.entries(styles).filter(([k]) => !BREAKPOINT_KEYS.has(k));
  if (!entries.length) return '';

  const body = entries
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');

  return ` style={{ ${body} }}`;
}

function escapeText(value: unknown): string {
  return JSON.stringify(String(value ?? ''));
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toKebabCase(input: string): string {
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function styleObjectToCss(styles: Record<string, unknown>): string {
  const entries = Object.entries(styles).filter(([k]) => !BREAKPOINT_KEYS.has(k));
  return entries
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)};`)
    .join(' ');
}

function pascalCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

// ─── Node → JSX string ────────────────────────────────────────────────────────

function nodeToJsx(node: EditorNode, indent = 4): string {
  const pad = ' '.repeat(indent);
  const styleAttr = styleObjectToJsx(node.styles as Record<string, unknown>);
  const childrenJsx = node.children.map((c) => nodeToJsx(c, indent + 2)).join('\n');

  switch (node.type) {
    case 'heading': {
      const level = Number(node.props.level ?? 2);
      const safeLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
      return `${pad}<h${safeLevel}${styleAttr}>{${escapeText(node.props.text)}}</h${safeLevel}>`;
    }
    case 'paragraph':
      return `${pad}<p${styleAttr}>{${escapeText(node.props.text)}}</p>`;
    case 'list': {
      const items = (node.props.items as string[]) ?? [];
      const Tag = (node.props.ordered as boolean) ? 'ol' : 'ul';
      const body = items.map((item) => `${pad}  <li>{${escapeText(item)}}</li>`).join('\n');
      return `${pad}<${Tag}${styleAttr}>${body ? `\n${body}\n${pad}` : ''}</${Tag}>`;
    }
    case 'link':
      return `${pad}<a href={${escapeText(node.props.href ?? '#')}} target={${escapeText(node.props.target ?? '_blank')}} rel="noreferrer"${styleAttr}>{${escapeText(node.props.text)}}</a>`;
    case 'html-element': {
      const tag = String(node.props.tag ?? 'span');
      const safeTag = SAFE_TEXT_TAGS.has(tag) ? tag : 'span';
      return `${pad}<${safeTag}${styleAttr}>{${escapeText(node.props.text)}}</${safeTag}>`;
    }
    case 'html-container': {
      const tag = String(node.props.tag ?? 'div');
      const safeTag = SAFE_CONTAINER_TAGS.has(tag) ? tag : 'div';
      return `${pad}<${safeTag}${styleAttr}>${childrenJsx ? `\n${childrenJsx}\n${pad}` : ''}</${safeTag}>`;
    }
    case 'label':
    case 'badge':
      return `${pad}<span${styleAttr}>{${escapeText(node.props.text)}}</span>`;
    case 'button':
      return `${pad}<button type="button"${styleAttr}>{${escapeText(node.props.text)}}</button>`;
    case 'input':
      return `${pad}<input type={${escapeText(node.props.type ?? 'text')}} name={${escapeText(node.props.name ?? '')}} aria-label={${escapeText(node.props.ariaLabel ?? 'Text input')}} placeholder={${escapeText(node.props.placeholder)}}${styleAttr} />`;
    case 'textarea':
      return `${pad}<textarea name={${escapeText(node.props.name ?? '')}} aria-label={${escapeText(node.props.ariaLabel ?? 'Text area')}} placeholder={${escapeText(node.props.placeholder ?? '')}} rows={${JSON.stringify(Number(node.props.rows ?? 5))}} defaultValue={${escapeText(node.props.value ?? '')}}${styleAttr} />`;
    case 'select': {
      const options = getOptionList(node);
      const selectedValue = normalizeOptionValue(String(node.props.value ?? options[0] ?? ''));
      const optionNodes = options
        .map((option) => `${pad}  <option value={${escapeText(normalizeOptionValue(option))}}>{${escapeText(option)}}</option>`)
        .join('\n');
      return `${pad}<select name={${escapeText(node.props.name ?? '')}} aria-label={${escapeText(node.props.ariaLabel ?? 'Select input')}} defaultValue={${escapeText(selectedValue)}}${styleAttr}>${optionNodes ? `\n${optionNodes}\n${pad}` : ''}</select>`;
    }
    case 'image':
      return `${pad}<img src={${escapeText(node.props.src)}} alt={${escapeText(node.props.alt)}}${styleAttr} />`;
    case 'video':
      return `${pad}<video src={${escapeText(node.props.src)}} poster={${escapeText(node.props.poster)}} controls${styleAttr} />`;
    case 'icon':
      return `${pad}<span aria-label={${escapeText(node.props.ariaLabel ?? 'icon')}}${styleAttr}>{${escapeText(node.props.iconName ?? 'icon')}}</span>`;
    case 'spacer':
      return `${pad}<div${styleAttr} />`;
    case 'navbar':
      return `${pad}<nav${styleAttr}>\n${pad}  <span>{${escapeText(node.props.brand)}}</span>\n${pad}</nav>`;
    case 'hero':
      return `${pad}<section${styleAttr}>\n${pad}  <h1>{${escapeText(node.props.title)}}</h1>\n${pad}  <p>{${escapeText(node.props.subtitle)}}</p>\n${pad}  <button type="button">{${escapeText(node.props.ctaText)}}</button>${childrenJsx ? `\n${childrenJsx}` : ''}\n${pad}</section>`;
    case 'footer':
      return `${pad}<footer${styleAttr}>{${escapeText(node.props.copyright)}}</footer>`;
    case 'testimonial':
      return `${pad}<div${styleAttr}>\n${pad}  <blockquote><p>{${escapeText(node.props.quote)}}</p></blockquote>\n${pad}  <p><strong>{${escapeText(node.props.author)}}</strong></p>\n${pad}  <p>{${escapeText(node.props.role)}}</p>\n${pad}</div>`;
    case 'feature-grid': {
      const features = (node.props.features as Array<{ title: string; description: string }>) ?? [];
      const featureItems = features.map((f) => `${pad}  <div>\n${pad}    <h3>{${escapeText(f.title)}}</h3>\n${pad}    <p>{${escapeText(f.description)}}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<div${styleAttr}>${featureItems ? `\n${featureItems}\n${pad}` : ''}</div>`;
    }
    case 'pricing-table':
      return `${pad}<div${styleAttr}>{/* pricing-table - customize as needed */}</div>`;
    case 'faq': {
      const questions = (node.props.questions as Array<{ q: string; a: string }>) ?? [];
      const items = questions.map((item) => `${pad}  <div>\n${pad}    <h4>{${escapeText(item.q)}}</h4>\n${pad}    <p>{${escapeText(item.a)}}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<div${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</div>`;
    }
    case 'cta-banner':
      return `${pad}<section${styleAttr}>\n${pad}  <p>{${escapeText(node.props.eyebrow)}}</p>\n${pad}  <h2>{${escapeText(node.props.title)}}</h2>\n${pad}  <p>{${escapeText(node.props.subtitle)}}</p>\n${pad}  <div>\n${pad}    <button type="button">{${escapeText(node.props.primaryCta)}}</button>\n${pad}    <button type="button">{${escapeText(node.props.secondaryCta)}}</button>\n${pad}  </div>\n${pad}</section>`;
    case 'stats-strip': {
      const stats = (node.props.stats as Array<{ label: string; value: string; helper?: string }>) ?? [];
      const items = stats.map((stat) => `${pad}  <div>\n${pad}    <span>{${escapeText(stat.label)}}</span>\n${pad}    <strong>{${escapeText(stat.value)}}</strong>\n${pad}    <small>{${escapeText(stat.helper)}}</small>\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</section>`;
    }
    case 'tabs': {
      const items = (node.props.items as Array<{ label: string; content: string }>) ?? [];
      const activeIndex = Number(node.props.activeIndex ?? 0);
      const activeItem = items[Math.max(0, Math.min(activeIndex, Math.max(0, items.length - 1)))];
      const labels = items.map((item) => item.label).join(' | ');
      return `${pad}<section${styleAttr}>\n${pad}  {/* Tabs: ${labels} */}\n${pad}  <p>{${escapeText(activeItem?.content ?? '')}}</p>\n${pad}</section>`;
    }
    case 'accordion': {
      const items = (node.props.items as Array<{ title: string; content: string }>) ?? [];
      const openIndex = Number(node.props.openIndex ?? 0);
      const mapped = items.map((item, i) => `${pad}  <div>\n${pad}    <h4>{${escapeText(item.title)}}</h4>${i === openIndex ? `\n${pad}    <p>{${escapeText(item.content)}}</p>` : ''}\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    case 'timeline': {
      const items = (node.props.items as Array<{ date: string; title: string; description: string }>) ?? [];
      const mapped = items.map((item) => `${pad}  <div>\n${pad}    <small>{${escapeText(item.date)}}</small>\n${pad}    <h4>{${escapeText(item.title)}}</h4>\n${pad}    <p>{${escapeText(item.description)}}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    case 'carousel': {
      const slides = (node.props.slides as Array<{ title: string; description: string; image: string }>) ?? [];
      const activeIndex = Number(node.props.activeIndex ?? 0);
      const current = slides[Math.max(0, Math.min(activeIndex, Math.max(0, slides.length - 1)))];
      return `${pad}<section${styleAttr}>\n${pad}  <img src={${escapeText(current?.image ?? '')}} alt={${escapeText(current?.title ?? 'Slide')}} />\n${pad}  <h3>{${escapeText(current?.title ?? '')}}</h3>\n${pad}  <p>{${escapeText(current?.description ?? '')}}</p>\n${pad}</section>`;
    }
    case 'comparison-table': {
      const columns = (node.props.columns as string[]) ?? [];
      const rows = (node.props.rows as Array<{ feature: string; values: string[] }>) ?? [];
      const head = columns.map((col) => `${pad}      <th>{${escapeText(col)}}</th>`).join('\n');
      const body = rows.map((row) => `${pad}      <tr>\n${pad}        <td>{${escapeText(row.feature)}}</td>\n${(row.values ?? []).map((value) => `${pad}        <td>{${escapeText(value)}}</td>`).join('\n')}\n${pad}      </tr>`).join('\n');
      return `${pad}<table${styleAttr}>\n${pad}  <thead>\n${pad}    <tr>\n${pad}      <th>{${escapeText('Feature')}}</th>\n${head}\n${pad}    </tr>\n${pad}  </thead>\n${pad}  <tbody>\n${body}\n${pad}  </tbody>\n${pad}</table>`;
    }
    case 'team-grid': {
      const members = (node.props.members as Array<{ name: string; role: string; bio: string; avatar: string }>) ?? [];
      const mapped = members.map((member) => `${pad}  <article>\n${pad}    <img src={${escapeText(member.avatar)}} alt={${escapeText(member.name)}} />\n${pad}    <h4>{${escapeText(member.name)}}</h4>\n${pad}    <p>{${escapeText(member.role)}}</p>\n${pad}    <p>{${escapeText(member.bio)}}</p>\n${pad}  </article>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    default:
      return `${pad}<div${styleAttr}>${childrenJsx ? `\n${childrenJsx}\n${pad}` : ''}</div>`;
  }
}

function generateGeneratedPage(nodes: EditorNode[]): string {
  const body = nodes.map((n) => nodeToJsx(n)).join('\n');
  return `import React from 'react';

export default function GeneratedPage() {
  return (
    <div>
${body}
    </div>
  );
}
`;
}

function nodeToHtml(node: EditorNode, indent = 4): string {
  const pad = ' '.repeat(indent);
  const style = styleObjectToCss(node.styles as Record<string, unknown>);
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : '';
  const childrenHtml = node.children.map((c) => nodeToHtml(c, indent + 2)).join('\n');

  switch (node.type) {
    case 'heading': {
      const level = Number(node.props.level ?? 2);
      const safeLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
      return `${pad}<h${safeLevel}${styleAttr}>${escapeHtml(node.props.text)}</h${safeLevel}>`;
    }
    case 'paragraph':
      return `${pad}<p${styleAttr}>${escapeHtml(node.props.text)}</p>`;
    case 'list': {
      const items = (node.props.items as string[]) ?? [];
      const Tag = (node.props.ordered as boolean) ? 'ol' : 'ul';
      const body = items.map((item) => `${pad}  <li>${escapeHtml(item)}</li>`).join('\n');
      return `${pad}<${Tag}${styleAttr}>${body ? `\n${body}\n${pad}` : ''}</${Tag}>`;
    }
    case 'link':
      return `${pad}<a href="${escapeHtml(node.props.href ?? '#')}" target="${escapeHtml(node.props.target ?? '_blank')}" rel="noreferrer"${styleAttr}>${escapeHtml(node.props.text)}</a>`;
    case 'html-element': {
      const tag = String(node.props.tag ?? 'span');
      const safeTag = SAFE_TEXT_TAGS.has(tag) ? tag : 'span';
      return `${pad}<${safeTag}${styleAttr}>${escapeHtml(node.props.text)}</${safeTag}>`;
    }
    case 'html-container': {
      const tag = String(node.props.tag ?? 'div');
      const safeTag = SAFE_CONTAINER_TAGS.has(tag) ? tag : 'div';
      return `${pad}<${safeTag}${styleAttr}>${childrenHtml ? `\n${childrenHtml}\n${pad}` : ''}</${safeTag}>`;
    }
    case 'label':
    case 'badge':
      return `${pad}<span${styleAttr}>${escapeHtml(node.props.text)}</span>`;
    case 'button':
      return `${pad}<button type="button"${styleAttr}>${escapeHtml(node.props.text)}</button>`;
    case 'input':
      return `${pad}<input type="${escapeHtml(node.props.type ?? 'text')}" name="${escapeHtml(node.props.name ?? '')}" aria-label="${escapeHtml(node.props.ariaLabel ?? 'Text input')}" placeholder="${escapeHtml(node.props.placeholder)}"${styleAttr} />`;
    case 'textarea':
      return `${pad}<textarea name="${escapeHtml(node.props.name ?? '')}" aria-label="${escapeHtml(node.props.ariaLabel ?? 'Text area')}" placeholder="${escapeHtml(node.props.placeholder ?? '')}" rows="${escapeHtml(node.props.rows ?? 5)}"${styleAttr}>${escapeHtml(node.props.value ?? '')}</textarea>`;
    case 'select': {
      const options = getOptionList(node);
      const selectedValue = normalizeOptionValue(String(node.props.value ?? options[0] ?? ''));
      const optionNodes = options
        .map((option) => {
          const optionValue = normalizeOptionValue(option);
          const selectedAttr = optionValue === selectedValue ? ' selected' : '';
          return `${pad}  <option value="${escapeHtml(optionValue)}"${selectedAttr}>${escapeHtml(option)}</option>`;
        })
        .join('\n');
      return `${pad}<select name="${escapeHtml(node.props.name ?? '')}" aria-label="${escapeHtml(node.props.ariaLabel ?? 'Select input')}"${styleAttr}>${optionNodes ? `\n${optionNodes}\n${pad}` : ''}</select>`;
    }
    case 'image':
      return `${pad}<img src="${escapeHtml(node.props.src)}" alt="${escapeHtml(node.props.alt)}"${styleAttr} />`;
    case 'video':
      return `${pad}<video src="${escapeHtml(node.props.src)}" poster="${escapeHtml(node.props.poster)}" controls${styleAttr}></video>`;
    case 'icon':
      return `${pad}<span aria-label="${escapeHtml(node.props.ariaLabel ?? 'icon')}"${styleAttr}>${escapeHtml(node.props.iconName ?? 'icon')}</span>`;
    case 'spacer':
      return `${pad}<div${styleAttr}></div>`;
    case 'navbar':
      return `${pad}<nav${styleAttr}>\n${pad}  <span>${escapeHtml(node.props.brand)}</span>\n${pad}</nav>`;
    case 'hero':
      return `${pad}<section${styleAttr}>\n${pad}  <h1>${escapeHtml(node.props.title)}</h1>\n${pad}  <p>${escapeHtml(node.props.subtitle)}</p>\n${pad}  <button type="button">${escapeHtml(node.props.ctaText)}</button>${childrenHtml ? `\n${childrenHtml}` : ''}\n${pad}</section>`;
    case 'footer':
      return `${pad}<footer${styleAttr}>${escapeHtml(node.props.copyright)}</footer>`;
    case 'testimonial':
      return `${pad}<div${styleAttr}>\n${pad}  <blockquote><p>${escapeHtml(node.props.quote)}</p></blockquote>\n${pad}  <p><strong>${escapeHtml(node.props.author)}</strong></p>\n${pad}  <p>${escapeHtml(node.props.role)}</p>\n${pad}</div>`;
    case 'feature-grid': {
      const features = (node.props.features as Array<{ title: string; description: string }>) ?? [];
      const items = features.map((item) => `${pad}  <div>\n${pad}    <h3>${escapeHtml(item.title)}</h3>\n${pad}    <p>${escapeHtml(item.description)}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<div${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</div>`;
    }
    case 'pricing-table': {
      const plans = (node.props.plans as Array<{ name: string; price: string; features: string[]; ctaText: string }>) ?? [];
      const items = plans.map((plan) => `${pad}  <article>\n${pad}    <h3>${escapeHtml(plan.name)}</h3>\n${pad}    <p>${escapeHtml(plan.price)}</p>\n${pad}    <ul>\n${(plan.features ?? []).map((f) => `${pad}      <li>${escapeHtml(f)}</li>`).join('\n')}\n${pad}    </ul>\n${pad}    <button type="button">${escapeHtml(plan.ctaText)}</button>\n${pad}  </article>`).join('\n');
      return `${pad}<section${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</section>`;
    }
    case 'faq': {
      const questions = (node.props.questions as Array<{ q: string; a: string }>) ?? [];
      const items = questions.map((item) => `${pad}  <div>\n${pad}    <h4>${escapeHtml(item.q)}</h4>\n${pad}    <p>${escapeHtml(item.a)}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</section>`;
    }
    case 'cta-banner':
      return `${pad}<section${styleAttr}>\n${pad}  <p>${escapeHtml(node.props.eyebrow)}</p>\n${pad}  <h2>${escapeHtml(node.props.title)}</h2>\n${pad}  <p>${escapeHtml(node.props.subtitle)}</p>\n${pad}  <div>\n${pad}    <button type="button">${escapeHtml(node.props.primaryCta)}</button>\n${pad}    <button type="button">${escapeHtml(node.props.secondaryCta)}</button>\n${pad}  </div>\n${pad}</section>`;
    case 'stats-strip': {
      const stats = (node.props.stats as Array<{ label: string; value: string; helper?: string }>) ?? [];
      const items = stats.map((stat) => `${pad}  <div>\n${pad}    <span>${escapeHtml(stat.label)}</span>\n${pad}    <strong>${escapeHtml(stat.value)}</strong>\n${pad}    <small>${escapeHtml(stat.helper)}</small>\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</section>`;
    }
    case 'tabs': {
      const items = (node.props.items as Array<{ label: string; content: string }>) ?? [];
      const activeIndex = Number(node.props.activeIndex ?? 0);
      const activeItem = items[Math.max(0, Math.min(activeIndex, Math.max(0, items.length - 1)))];
      return `${pad}<section${styleAttr}>\n${pad}  <div>${items.map((item) => escapeHtml(item.label)).join(' | ')}</div>\n${pad}  <p>${escapeHtml(activeItem?.content ?? '')}</p>\n${pad}</section>`;
    }
    case 'accordion': {
      const items = (node.props.items as Array<{ title: string; content: string }>) ?? [];
      const openIndex = Number(node.props.openIndex ?? 0);
      const mapped = items.map((item, i) => `${pad}  <div>\n${pad}    <h4>${escapeHtml(item.title)}</h4>${i === openIndex ? `\n${pad}    <p>${escapeHtml(item.content)}</p>` : ''}\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    case 'timeline': {
      const items = (node.props.items as Array<{ date: string; title: string; description: string }>) ?? [];
      const mapped = items.map((item) => `${pad}  <div>\n${pad}    <small>${escapeHtml(item.date)}</small>\n${pad}    <h4>${escapeHtml(item.title)}</h4>\n${pad}    <p>${escapeHtml(item.description)}</p>\n${pad}  </div>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    case 'carousel': {
      const slides = (node.props.slides as Array<{ title: string; description: string; image: string }>) ?? [];
      const activeIndex = Number(node.props.activeIndex ?? 0);
      const current = slides[Math.max(0, Math.min(activeIndex, Math.max(0, slides.length - 1)))];
      return `${pad}<section${styleAttr}>\n${pad}  <img src="${escapeHtml(current?.image ?? '')}" alt="${escapeHtml(current?.title ?? 'Slide')}" />\n${pad}  <h3>${escapeHtml(current?.title ?? '')}</h3>\n${pad}  <p>${escapeHtml(current?.description ?? '')}</p>\n${pad}</section>`;
    }
    case 'comparison-table': {
      const columns = (node.props.columns as string[]) ?? [];
      const rows = (node.props.rows as Array<{ feature: string; values: string[] }>) ?? [];
      const head = columns.map((col) => `${pad}      <th>${escapeHtml(col)}</th>`).join('\n');
      const body = rows.map((row) => `${pad}      <tr>\n${pad}        <td>${escapeHtml(row.feature)}</td>\n${(row.values ?? []).map((value) => `${pad}        <td>${escapeHtml(value)}</td>`).join('\n')}\n${pad}      </tr>`).join('\n');
      return `${pad}<table${styleAttr}>\n${pad}  <thead>\n${pad}    <tr>\n${pad}      <th>${escapeHtml('Feature')}</th>\n${head}\n${pad}    </tr>\n${pad}  </thead>\n${pad}  <tbody>\n${body}\n${pad}  </tbody>\n${pad}</table>`;
    }
    case 'team-grid': {
      const members = (node.props.members as Array<{ name: string; role: string; bio: string; avatar: string }>) ?? [];
      const mapped = members.map((member) => `${pad}  <article>\n${pad}    <img src="${escapeHtml(member.avatar)}" alt="${escapeHtml(member.name)}" />\n${pad}    <h4>${escapeHtml(member.name)}</h4>\n${pad}    <p>${escapeHtml(member.role)}</p>\n${pad}    <p>${escapeHtml(member.bio)}</p>\n${pad}  </article>`).join('\n');
      return `${pad}<section${styleAttr}>${mapped ? `\n${mapped}\n${pad}` : ''}</section>`;
    }
    default:
      return `${pad}<div${styleAttr}>${childrenHtml ? `\n${childrenHtml}\n${pad}` : ''}</div>`;
  }
}

function generateStandaloneHtml(nodes: EditorNode[], projectName: string, theme?: ThemeConfig): string {
  const body = nodes.map((node) => nodeToHtml(node)).join('\n');
  const themeVarsCss = getThemeCssVarsCss(theme ?? useEditorStore.getState().theme);
  const bodyStyle = [
    'margin: 0',
    `font-family: ${theme?.typography.fontFamily ?? 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'}`,
    `font-size: ${theme?.typography.baseFontSize ?? '16px'}`,
    `background: ${themeVar.background}`,
    `color: ${themeVar.text}`,
  ].join('; ');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(projectName)}</title>
    <style>
      :root {
        ${themeVarsCss}
      }
    </style>
  </head>
  <body style="${escapeHtml(bodyStyle)};">
${body}
  </body>
</html>
`;
}

function generateAppTsx(): string {
  return `import React from 'react';
import GeneratedPage from './components/GeneratedPage';

export default function App() {
  return <GeneratedPage />;
}
`;
}

function generateMainTsx(includeIndexCss: boolean): string {
  const cssImport = includeIndexCss ? "import './index.css';\n" : '';
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
${cssImport}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

function generateIndexCss(): string {
  return `:root {
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
`;
}

function generatePackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName.replace(/\s+/g, '-').toLowerCase() || 'site-builder-export',
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        vite: '^5.4.21',
        typescript: '^5.5.3',
        '@types/react': '^18.3.3',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.1',
      },
    },
    null,
    2
  );
}

function generateReadme(projectName: string): string {
  return `# ${projectName}

Generated by UI Site Builder.

## Run locally

1. npm install
2. npm run dev
`;
}

async function downloadZip(filename: string, zip: JSZip): Promise<void> {
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function exportProject() {
  return exportProjectWithOptions({
    mode: 'react-zip',
    includePackageJson: true,
    includeReadme: true,
    includeIndexCss: true,
  });
}

export async function exportProjectWithOptions(options: ExportOptions) {
  const { pageTree, projectName, theme } = useEditorStore.getState();
  trackEvent('project_export_started', {
    mode: options.mode,
    nodeCount: pageTree.length,
    projectName,
  });

  if (options.mode === 'html-file') {
    const html = generateStandaloneHtml(pageTree, projectName, theme);
    const safeBase = pascalCase(projectName) || 'SiteBuilderExport';
    downloadTextFile(`${safeBase}.html`, html, 'text/html;charset=utf-8');
    trackEvent('project_export_completed', {
      mode: options.mode,
      projectName,
      nodeCount: pageTree.length,
    });
    return;
  }

  const zip = new JSZip();

  if (options.includePackageJson) {
    zip.file('package.json', generatePackageJson(projectName));
  }

  if (options.includeReadme) {
    zip.file('README.md', generateReadme(projectName));
  }

  zip.file(
    'index.html',
    `<!doctype html>\n<html>\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${projectName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`
  );

  zip.file('src/main.tsx', generateMainTsx(options.includeIndexCss));
  zip.file('src/App.tsx', generateAppTsx());
  if (options.includeIndexCss) {
    zip.file('src/index.css', generateIndexCss());
  }
  zip.file('src/components/GeneratedPage.tsx', generateGeneratedPage(pageTree));

  const safeBase = pascalCase(projectName) || 'SiteBuilderExport';
  try {
    await downloadZip(`${safeBase}.zip`, zip);
    trackEvent('project_export_completed', {
      mode: options.mode,
      projectName,
      nodeCount: pageTree.length,
    });
  } catch (error) {
    trackEvent('project_export_failed', {
      mode: options.mode,
      projectName,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}

export function copyPageHtml(): void {
  const { pageTree } = useEditorStore.getState();
  const code = generateGeneratedPage(pageTree);
  trackEvent('code_copied', { source: 'exporter', nodeCount: pageTree.length });
  navigator.clipboard.writeText(code).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = code;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

export function getPageJsx(): string {
  const { pageTree } = useEditorStore.getState();
  return generateGeneratedPage(pageTree);
}

export function getPageHtml(projectName?: string): string {
  const { pageTree, projectName: storeName, theme } = useEditorStore.getState();
  return generateStandaloneHtml(pageTree, projectName ?? storeName, theme);
}

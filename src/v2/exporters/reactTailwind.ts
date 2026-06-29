import type { V2Document, V2Node } from '../schema';

const SPACING_MAP: Record<string, string> = {
  '0px': '0',
  '2px': '0.5',
  '4px': '1',
  '6px': '1.5',
  '8px': '2',
  '10px': '2.5',
  '12px': '3',
  '14px': '3.5',
  '16px': '4',
  '20px': '5',
  '24px': '6',
  '28px': '7',
  '32px': '8',
  '40px': '10',
  '48px': '12',
  '56px': '14',
  '64px': '16',
};

function normalizeSpaceValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (SPACING_MAP[normalized]) return SPACING_MAP[normalized];
  return null;
}

function toStyleString(style: Record<string, unknown>): string {
  const entries = Object.entries(style);
  if (!entries.length) return '';
  const body = entries
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ');
  return ` style={{ ${body} }}`;
}

function styleToClassAndInline(style: Record<string, unknown>): {
  className: string;
  inline: Record<string, unknown>;
} {
  const classes: string[] = [];
  const inline: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(style ?? {})) {
    const value = String(raw);

    if (key === 'display') {
      if (value === 'flex') classes.push('flex');
      else if (value === 'grid') classes.push('grid');
      else if (value === 'block') classes.push('block');
      else inline[key] = raw;
      continue;
    }

    if (key === 'flexDirection') {
      if (value === 'column') classes.push('flex-col');
      else if (value === 'row') classes.push('flex-row');
      else inline[key] = raw;
      continue;
    }

    if (key === 'alignItems') {
      if (value === 'center') classes.push('items-center');
      else if (value === 'stretch') classes.push('items-stretch');
      else if (value === 'flex-start') classes.push('items-start');
      else if (value === 'flex-end') classes.push('items-end');
      else inline[key] = raw;
      continue;
    }

    if (key === 'justifyContent') {
      if (value === 'center') classes.push('justify-center');
      else if (value === 'space-between') classes.push('justify-between');
      else if (value === 'space-around') classes.push('justify-around');
      else if (value === 'flex-start') classes.push('justify-start');
      else if (value === 'flex-end') classes.push('justify-end');
      else inline[key] = raw;
      continue;
    }

    if (key === 'textAlign') {
      if (value === 'center') classes.push('text-center');
      else if (value === 'left') classes.push('text-left');
      else if (value === 'right') classes.push('text-right');
      else inline[key] = raw;
      continue;
    }

    if (key === 'fontWeight') {
      if (value === '700' || value === 'bold') classes.push('font-bold');
      else if (value === '600') classes.push('font-semibold');
      else if (value === '500') classes.push('font-medium');
      else inline[key] = raw;
      continue;
    }

    if (key === 'width' && value === '100%') {
      classes.push('w-full');
      continue;
    }

    if (key === 'borderRadius') {
      if (value === '9999px') classes.push('rounded-full');
      else if (value === '12px') classes.push('rounded-xl');
      else if (value === '10px') classes.push('rounded-lg');
      else if (value === '8px') classes.push('rounded-md');
      else inline[key] = raw;
      continue;
    }

    if (key === 'padding') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`p-${tw}`);
      else inline[key] = raw;
      continue;
    }

    if (key === 'paddingTop') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`pt-${tw}`);
      else inline[key] = raw;
      continue;
    }

    if (key === 'paddingBottom') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`pb-${tw}`);
      else inline[key] = raw;
      continue;
    }

    if (key === 'paddingLeft') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`pl-${tw}`);
      else inline[key] = raw;
      continue;
    }

    if (key === 'paddingRight') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`pr-${tw}`);
      else inline[key] = raw;
      continue;
    }

    if (key === 'gap') {
      const tw = normalizeSpaceValue(raw);
      if (tw) classes.push(`gap-${tw}`);
      else inline[key] = raw;
      continue;
    }

    inline[key] = raw;
  }

  return {
    className: classes.join(' '),
    inline,
  };
}

function escape(value: unknown): string {
  return JSON.stringify(String(value ?? ''));
}

function nodeToJsx(node: V2Node, indent = 4): string {
  const pad = ' '.repeat(indent);
  const childJsx = node.children.map((child) => nodeToJsx(child, indent + 2)).join('\n');
  const { className, inline } = styleToClassAndInline(node.style);
  const classAttr = className ? ` className=${escape(className)}` : '';
  const styleAttr = toStyleString(inline);

  switch (node.type) {
    case 'heading': {
      const level = Number(node.props.level ?? 2);
      const safe = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2;
      return `${pad}<h${safe}${classAttr}${styleAttr}>{${escape(node.props.text ?? '')}}</h${safe}>`;
    }
    case 'text':
      return `${pad}<p${classAttr}${styleAttr}>{${escape(node.props.text ?? '')}}</p>`;
    case 'button':
      return `${pad}<button type=\"button\"${classAttr}${styleAttr}>{${escape(node.props.text ?? 'Button')}}</button>`;
    case 'input':
      return `${pad}<input type={${escape(node.props.type ?? 'text')}} name={${escape(node.props.name ?? '')}} placeholder={${escape(node.props.placeholder ?? '')}}${classAttr}${styleAttr} />`;
    case 'textarea':
      return `${pad}<textarea name={${escape(node.props.name ?? '')}} rows={${JSON.stringify(Number(node.props.rows ?? 5))}} placeholder={${escape(node.props.placeholder ?? '')}}${classAttr}${styleAttr}>{${escape(node.props.value ?? '')}}</textarea>`;
    case 'select': {
      const options = ((node.props.options as string[]) ?? []).filter(Boolean);
      const optionJsx = options
        .map((option) => `${pad}  <option value={${escape(option)}}>{${escape(option)}}</option>`)
        .join('\n');
      return `${pad}<select name={${escape(node.props.name ?? '')}} defaultValue={${escape(node.props.value ?? options[0] ?? '')}}${classAttr}${styleAttr}>${optionJsx ? `\n${optionJsx}\n${pad}` : ''}</select>`;
    }
    case 'image':
      return `${pad}<img src={${escape(node.props.src ?? '')}} alt={${escape(node.props.alt ?? '')}}${classAttr}${styleAttr} />`;
    case 'video':
      return `${pad}<video src={${escape(node.props.src ?? '')}} poster={${escape(node.props.poster ?? '')}} controls${classAttr}${styleAttr} />`;
    case 'icon':
      return `${pad}<span${classAttr}${styleAttr} aria-label={${escape(node.props.ariaLabel ?? 'icon')}}>{${escape(node.props.iconName ?? 'icon')}}</span>`;
    case 'link':
      return `${pad}<a href={${escape(node.props.href ?? '#')}} target={${escape(node.props.target ?? '_self')}} rel=\"noreferrer\"${classAttr}${styleAttr}>{${escape(node.props.text ?? 'Link')}}</a>`;
    case 'list': {
      const ordered = Boolean(node.props.ordered);
      const tag = ordered ? 'ol' : 'ul';
      const items = ((node.props.items as string[]) ?? []).map((item) => `${pad}  <li>{${escape(item)}}</li>`).join('\n');
      return `${pad}<${tag}${classAttr}${styleAttr}>${items ? `\n${items}\n${pad}` : ''}</${tag}>`;
    }
    case 'section':
    case 'container':
    case 'stack':
    case 'grid':
      return `${pad}<div data-component={${escape(node.component)}}${classAttr}${styleAttr}>${childJsx ? `\n${childJsx}\n${pad}` : ''}</div>`;
    case 'custom':
    default:
      return `${pad}<div data-component={${escape(node.component)}}${classAttr}${styleAttr}>${childJsx ? `\n${childJsx}\n${pad}` : ''}</div>`;
  }
}

export function generateV2ReactTailwindPage(document: V2Document): string {
  const firstPage = document.pages[0];
  const body = (firstPage?.nodes ?? []).map((node) => nodeToJsx(node, 6)).join('\n');
  const pageName = firstPage?.name ?? document.name;
  const safeName = pageName.replace(/[^a-zA-Z0-9]/g, '');
  const componentName = /^[A-Z]/.test(safeName) ? safeName : `Generated${safeName || 'Page'}`;

  return `import React from 'react';

export default function ${componentName}() {
  return (
    <main className=\"min-h-screen w-full\">\n${body}\n    </main>
  );
}
`;
}

export function generateV2ReactTailwindProjectFiles(document: V2Document): Record<string, string> {
  const pageCode = generateV2ReactTailwindPage(document);

  return {
    'package.json': JSON.stringify(
      {
        name: document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'v2-site-builder-export',
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
          '@types/react': '^18.3.3',
          '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.3.1',
          autoprefixer: '^10.4.19',
          postcss: '^8.4.38',
          tailwindcss: '^3.4.4',
          typescript: '^5.5.3',
          vite: '^5.4.21',
        },
      },
      null,
      2
    ),
    'index.html': `<!doctype html>
<html>
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>${document.name}</title>
  </head>
  <body>
    <div id=\"root\"></div>
    <script type=\"module\" src=\"/src/main.tsx\"></script>
  </body>
</html>
`,
    'postcss.config.js': `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
    'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
    'src/App.tsx': `import React from 'react';
import GeneratedPage from './GeneratedPage';

export default function App() {
  return <GeneratedPage />;
}
`,
    'src/GeneratedPage.tsx': pageCode,
    'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: ${document.theme.typography.fontFamily};
  font-size: ${document.theme.typography.baseFontSize};
}

body {
  margin: 0;
  min-height: 100vh;
}
`,
    'README.md': `# ${document.name}

Generated by SiteBuilder V2 React + Tailwind exporter.

## Run

1. npm install
2. npm run dev
`,
  };
}

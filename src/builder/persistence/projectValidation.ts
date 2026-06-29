import type { EditorNode, ProjectFile, ThemeConfig } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'string');
}

function validateTheme(value: unknown): value is ThemeConfig {
  if (!isRecord(value)) return false;
  if (typeof value.name !== 'string') return false;

  if (!isRecord(value.colors)) return false;
  const requiredColorKeys = [
    'primary',
    'secondary',
    'background',
    'surface',
    'text',
    'textMuted',
    'border',
  ] as const;
  for (const key of requiredColorKeys) {
    if (typeof value.colors[key] !== 'string') return false;
  }

  if (!isRecord(value.typography)) return false;
  if (typeof value.typography.fontFamily !== 'string') return false;
  if (typeof value.typography.baseFontSize !== 'string') return false;

  if (!isStringRecord(value.spacing)) return false;
  if (!isStringRecord(value.borderRadius)) return false;

  return true;
}

function validateNode(value: unknown): value is EditorNode {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.type !== 'string') return false;
  if (!isRecord(value.props)) return false;
  if (!isRecord(value.styles)) return false;
  if (!Array.isArray(value.children)) return false;

  return value.children.every((child) => validateNode(child));
}

export function validateProjectFile(input: unknown): ProjectFile {
  if (!isRecord(input)) {
    throw new Error('Project file must be an object');
  }

  if (typeof input.id !== 'string' || input.id.length === 0) {
    throw new Error('Project id is missing');
  }

  if (typeof input.name !== 'string' || input.name.length === 0) {
    throw new Error('Project name is missing');
  }

  if (typeof input.createdAt !== 'string' || typeof input.updatedAt !== 'string') {
    throw new Error('Project timestamps are invalid');
  }

  if (!validateTheme(input.theme)) {
    throw new Error('Project theme is invalid');
  }

  if (!Array.isArray(input.pages) || !input.pages.every((node) => validateNode(node))) {
    throw new Error('Project pages are invalid');
  }

  return {
    id: input.id as string,
    name: input.name as string,
    createdAt: input.createdAt as string,
    updatedAt: input.updatedAt as string,
    theme: input.theme as ThemeConfig,
    pages: input.pages as EditorNode[],
  };
}

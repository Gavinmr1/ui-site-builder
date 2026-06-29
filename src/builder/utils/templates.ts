import type { EditorNode } from '../types';
import { nanoid } from './nanoid';

export interface SavedTemplate {
  id: string;
  name: string;
  node: EditorNode;
  createdAt: string;
}

const STORAGE_KEY = 'component-templates';
export const TEMPLATE_EVENT = 'sitebuilder-templates-updated';

function emitTemplateUpdate(): void {
  window.dispatchEvent(new CustomEvent(TEMPLATE_EVENT));
}

function writeTemplatesToStorage(templates: SavedTemplate[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return true;
  } catch (error) {
    console.warn('Failed to persist component templates', error);
    return false;
  }
}

export function loadTemplates(): SavedTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: SavedTemplate[]): void {
  if (!writeTemplatesToStorage(templates)) return;
  emitTemplateUpdate();
}

export function addTemplate(name: string, node: EditorNode): SavedTemplate | null {
  const template: SavedTemplate = {
    id: nanoid(),
    name: name.trim() || `Template ${new Date().toLocaleTimeString()}`,
    node: structuredClone(node),
    createdAt: new Date().toISOString(),
  };

  const current = loadTemplates();
  const next = [template, ...current].slice(0, 30);
  if (!writeTemplatesToStorage(next)) return null;
  emitTemplateUpdate();
  return template;
}

export function removeTemplate(templateId: string): boolean {
  const next = loadTemplates().filter((template) => template.id !== templateId);
  const previousLength = loadTemplates().length;
  if (next.length === previousLength) return false;
  saveTemplates(next);
  return true;
}

export function renameTemplate(templateId: string, name: string): boolean {
  const nextName = name.trim();
  if (!nextName) return false;

  let changed = false;
  const next = loadTemplates().map((template) =>
    template.id === templateId ? ((changed = true), { ...template, name: nextName }) : template
  );

  if (!changed) return false;
  saveTemplates(next);
  return true;
}

export function moveTemplate(templateId: string, direction: 'up' | 'down'): boolean {
  const current = loadTemplates();
  const index = current.findIndex((template) => template.id === templateId);
  if (index < 0) return false;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= current.length) return false;

  const next = [...current];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  saveTemplates(next);
  return true;
}

function cloneNodeWithNewIds(node: EditorNode): EditorNode {
  return {
    ...node,
    id: nanoid(),
    children: node.children.map(cloneNodeWithNewIds),
  };
}

export function instantiateTemplateNode(template: SavedTemplate): Omit<EditorNode, 'id'> {
  const root = cloneNodeWithNewIds(template.node);
  return {
    type: root.type,
    props: root.props,
    styles: root.styles,
    children: root.children,
  };
}

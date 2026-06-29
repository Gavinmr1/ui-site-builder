import type { V2NodeType } from './schema';

export interface PrimitiveFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'list';
  required?: boolean;
}

export interface PrimitiveDefinition {
  type: V2NodeType;
  label: string;
  acceptsChildren: boolean;
  fields: PrimitiveFieldDefinition[];
}

const componentToPrimitiveMap: Record<string, V2NodeType> = {
  section: 'section',
  container: 'container',
  'html-container': 'container',
  'flex-col': 'stack',
  'flex-row': 'stack',
  grid: 'grid',
  'feature-grid': 'grid',
  'team-grid': 'grid',
  heading: 'heading',
  paragraph: 'text',
  label: 'text',
  badge: 'text',
  'html-element': 'text',
  button: 'button',
  input: 'input',
  textarea: 'textarea',
  select: 'select',
  image: 'image',
  video: 'video',
  icon: 'icon',
  link: 'link',
  list: 'list',
};

export const primitiveDefinitions: Record<V2NodeType, PrimitiveDefinition> = {
  section: { type: 'section', label: 'Section', acceptsChildren: true, fields: [] },
  container: { type: 'container', label: 'Container', acceptsChildren: true, fields: [] },
  stack: { type: 'stack', label: 'Stack', acceptsChildren: true, fields: [] },
  grid: { type: 'grid', label: 'Grid', acceptsChildren: true, fields: [] },
  text: {
    type: 'text',
    label: 'Text',
    acceptsChildren: false,
    fields: [{ key: 'text', label: 'Text', type: 'text', required: true }],
  },
  heading: {
    type: 'heading',
    label: 'Heading',
    acceptsChildren: false,
    fields: [
      { key: 'text', label: 'Text', type: 'text', required: true },
      { key: 'level', label: 'Level', type: 'number' },
    ],
  },
  button: {
    type: 'button',
    label: 'Button',
    acceptsChildren: false,
    fields: [{ key: 'text', label: 'Label', type: 'text', required: true }],
  },
  input: {
    type: 'input',
    label: 'Input',
    acceptsChildren: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'placeholder', label: 'Placeholder', type: 'text' },
      { key: 'type', label: 'Type', type: 'text' },
    ],
  },
  textarea: {
    type: 'textarea',
    label: 'Textarea',
    acceptsChildren: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'placeholder', label: 'Placeholder', type: 'text' },
      { key: 'rows', label: 'Rows', type: 'number' },
    ],
  },
  select: {
    type: 'select',
    label: 'Select',
    acceptsChildren: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'options', label: 'Options', type: 'list', required: true },
      { key: 'value', label: 'Value', type: 'text' },
    ],
  },
  image: {
    type: 'image',
    label: 'Image',
    acceptsChildren: false,
    fields: [
      { key: 'src', label: 'Source', type: 'text', required: true },
      { key: 'alt', label: 'Alt text', type: 'text' },
    ],
  },
  video: {
    type: 'video',
    label: 'Video',
    acceptsChildren: false,
    fields: [
      { key: 'src', label: 'Source', type: 'text' },
      { key: 'poster', label: 'Poster', type: 'text' },
    ],
  },
  icon: {
    type: 'icon',
    label: 'Icon',
    acceptsChildren: false,
    fields: [{ key: 'iconName', label: 'Icon name', type: 'text', required: true }],
  },
  link: {
    type: 'link',
    label: 'Link',
    acceptsChildren: false,
    fields: [
      { key: 'text', label: 'Text', type: 'text', required: true },
      { key: 'href', label: 'Href', type: 'text', required: true },
      { key: 'target', label: 'Target', type: 'text' },
    ],
  },
  list: {
    type: 'list',
    label: 'List',
    acceptsChildren: false,
    fields: [{ key: 'items', label: 'Items', type: 'list', required: true }],
  },
  custom: { type: 'custom', label: 'Custom', acceptsChildren: true, fields: [] },
};

export function mapComponentToPrimitive(component: string): V2NodeType {
  return componentToPrimitiveMap[component] ?? 'custom';
}

export function getPrimitiveDefinition(type: V2NodeType): PrimitiveDefinition {
  return primitiveDefinitions[type];
}

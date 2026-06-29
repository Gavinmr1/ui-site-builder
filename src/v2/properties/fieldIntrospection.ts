import type { EditorNode } from '../../builder/types';
import { getPrimitiveDefinition, mapComponentToPrimitive } from '../primitives';
import type { V2NodeType } from '../schema';

export interface V2FieldInsight {
  primitiveType: V2NodeType;
  sourceType: string;
  fields: Array<{
    key: string;
    label: string;
    required: boolean;
    present: boolean;
    valuePreview: string;
  }>;
}

function previewValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} item(s)`;
  return '[object]';
}

export function introspectNodeFields(node: EditorNode): V2FieldInsight {
  const primitiveType = mapComponentToPrimitive(node.type);
  const primitive = getPrimitiveDefinition(primitiveType);

  return {
    primitiveType,
    sourceType: node.type,
    fields: primitive.fields.map((field) => {
      const value = node.props[field.key];
      const present = !(
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0)
      );

      return {
        key: field.key,
        label: field.label,
        required: Boolean(field.required),
        present,
        valuePreview: previewValue(value),
      };
    }),
  };
}

import type { V2Document, V2Node } from './schema';
import { getPrimitiveDefinition } from './primitives';

export interface V2ValidationIssue {
  path: string;
  message: string;
}

export interface V2ValidationResult {
  valid: boolean;
  issues: V2ValidationIssue[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateNode(node: V2Node, path: string, issues: V2ValidationIssue[]): void {
  if (!node.id || typeof node.id !== 'string') {
    issues.push({ path: `${path}.id`, message: 'Node id must be a non-empty string.' });
  }

  if (!node.type || typeof node.type !== 'string') {
    issues.push({ path: `${path}.type`, message: 'Node type must be a non-empty string.' });
  }

  if (!node.component || typeof node.component !== 'string') {
    issues.push({ path: `${path}.component`, message: 'Node component must be a non-empty string.' });
  }

  const primitive = getPrimitiveDefinition(node.type);
  if (!primitive) {
    issues.push({ path: `${path}.type`, message: `Unknown primitive type: ${node.type}` });
  }

  if (!isPlainObject(node.props)) {
    issues.push({ path: `${path}.props`, message: 'Node props must be an object.' });
  } else {
    for (const field of primitive.fields) {
      if (!field.required) continue;
      const value = node.props[field.key];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (missing) {
        issues.push({
          path: `${path}.props.${field.key}`,
          message: `${primitive.label} requires ${field.label}.`,
        });
      }
    }
  }

  if (!isPlainObject(node.style)) {
    issues.push({ path: `${path}.style`, message: 'Node style must be an object.' });
  }

  if (!Array.isArray(node.children)) {
    issues.push({ path: `${path}.children`, message: 'Node children must be an array.' });
    return;
  }

  if (!primitive.acceptsChildren && node.children.length > 0) {
    issues.push({
      path: `${path}.children`,
      message: `${primitive.label} does not accept child nodes.`,
    });
  }

  node.children.forEach((child, index) => {
    validateNode(child, `${path}.children[${index}]`, issues);
  });
}

export function validateV2Document(document: V2Document): V2ValidationResult {
  const issues: V2ValidationIssue[] = [];

  if (!document.id || typeof document.id !== 'string') {
    issues.push({ path: 'id', message: 'Document id must be a non-empty string.' });
  }

  if (document.version !== '2.0.0') {
    issues.push({ path: 'version', message: 'Document version must be 2.0.0.' });
  }

  if (!document.name || typeof document.name !== 'string') {
    issues.push({ path: 'name', message: 'Document name must be a non-empty string.' });
  }

  if (!Array.isArray(document.pages) || document.pages.length === 0) {
    issues.push({ path: 'pages', message: 'Document must contain at least one page.' });
  } else {
    document.pages.forEach((page, pageIndex) => {
      const pagePath = `pages[${pageIndex}]`;
      if (!page.id || typeof page.id !== 'string') {
        issues.push({ path: `${pagePath}.id`, message: 'Page id must be a non-empty string.' });
      }
      if (!page.name || typeof page.name !== 'string') {
        issues.push({ path: `${pagePath}.name`, message: 'Page name must be a non-empty string.' });
      }
      if (!page.slug || typeof page.slug !== 'string') {
        issues.push({ path: `${pagePath}.slug`, message: 'Page slug must be a non-empty string.' });
      }
      if (!Array.isArray(page.nodes)) {
        issues.push({ path: `${pagePath}.nodes`, message: 'Page nodes must be an array.' });
      } else {
        page.nodes.forEach((node, nodeIndex) => {
          validateNode(node, `${pagePath}.nodes[${nodeIndex}]`, issues);
        });
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

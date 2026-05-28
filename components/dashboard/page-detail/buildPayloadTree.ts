import { pathMatchesUsed } from '@/lib/analyzer';
import type { FieldShape } from '@/lib/types';
import type { FieldUsage, PayloadTreeNode } from './types';

function usageForPath(
  path: string,
  usedPaths: string[],
  unusedPaths: string[],
): FieldUsage {
  if (unusedPaths.some((p) => p === path || path.startsWith(`${p}.`) || p.startsWith(`${path}.`))) {
    return 'unused';
  }
  if (pathMatchesUsed(path, usedPaths)) {
    return 'used';
  }
  return 'unknown';
}

function buildTreeRecursive(
  shape: FieldShape,
  usedPaths: string[],
  unusedPaths: string[],
  prefix: string,
): PayloadTreeNode[] {
  if (shape.type === 'primitive') {
    if (!prefix) return [];
    const key = prefix.includes('.') ? (prefix.split('.').pop() ?? prefix) : prefix;
    return [
      {
        id: prefix,
        key,
        path: prefix,
        type: 'primitive',
        usage: usageForPath(prefix, usedPaths, unusedPaths),
        children: [],
      },
    ];
  }

  if (shape.type === 'array') {
    const arrayPath = prefix ? `${prefix}[]` : '[]';
    const key = prefix ? '[]' : 'root';
    return [
      {
        id: arrayPath,
        key,
        path: arrayPath,
        type: 'array',
        usage: usageForPath(arrayPath, usedPaths, unusedPaths),
        children: shape.itemShape
          ? buildTreeRecursive(shape.itemShape, usedPaths, unusedPaths, arrayPath)
          : [],
      },
    ];
  }

  return shape.keys.map((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const childShape = shape.children?.[key];
    const childType = childShape?.type === 'primitive' ? 'primitive' : 'object';
    return {
      id: path,
      key,
      path,
      type: childType,
      usage: usageForPath(path, usedPaths, unusedPaths),
      children:
        childShape && childShape.type !== 'primitive'
          ? buildTreeRecursive(childShape, usedPaths, unusedPaths, path)
          : [],
    };
  });
}

/** Builds a payload structure tree with per-field usage coloring. */
export function buildPayloadTreeFromRequest(
  shape: FieldShape,
  usedPaths: string[],
  unusedPaths: string[],
): PayloadTreeNode[] {
  return buildTreeRecursive(shape, usedPaths, unusedPaths, '');
}

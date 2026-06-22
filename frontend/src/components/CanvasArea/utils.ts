import type { ContentBounds } from './types';

export function mergeBounds(all: ContentBounds[]): ContentBounds {
  if (all.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  return {
    minX: Math.min(...all.map((b) => b.minX)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
}


export function nodeDisplayValue(node: { label: string; fields: Record<string, unknown> }): string {
  const fields = node.fields as Record<string, string>;
  if (fields.val) return fields.val;
  // Fallback: strip "TypeName(value)" → "value"
  const m = node.label.match(/\(([^)]+)\)$/);
  if (m) return m[1];
  return node.label;
}


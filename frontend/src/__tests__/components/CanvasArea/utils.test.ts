import { describe, it, expect } from 'vitest';
import { mergeBounds, nodeDisplayValue } from '../../../components/CanvasArea/utils';
import type { ContentBounds } from '../../../components/CanvasArea/types';

describe('mergeBounds', () => {
  it('returns default bounds for empty input', () => {
    const result = mergeBounds([]);
    expect(result).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
  });

  it('returns the same bounds for single input', () => {
    const single: ContentBounds = { minX: 10, maxX: 50, minY: 20, maxY: 60 };
    expect(mergeBounds([single])).toEqual(single);
  });

  it('merges two overlapping bounds', () => {
    const a: ContentBounds = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
    const b: ContentBounds = { minX: 50, maxX: 150, minY: 25, maxY: 75 };
    const result = mergeBounds([a, b]);
    expect(result).toEqual({ minX: 0, maxX: 150, minY: 0, maxY: 75 });
  });

  it('merges three disjoint bounds', () => {
    const a: ContentBounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const b: ContentBounds = { minX: 20, maxX: 30, minY: 20, maxY: 30 };
    const c: ContentBounds = { minX: 40, maxX: 50, minY: 40, maxY: 50 };
    const result = mergeBounds([a, b, c]);
    expect(result).toEqual({ minX: 0, maxX: 50, minY: 0, maxY: 50 });
  });
});

describe('nodeDisplayValue', () => {
  it('returns val field when present', () => {
    expect(nodeDisplayValue({ label: 'Node(42)', fields: { val: '99' } })).toBe('99');
  });

  it('falls back to label parenthesized value', () => {
    expect(nodeDisplayValue({ label: 'ListNode(7)', fields: {} })).toBe('7');
  });

  it('returns full label when no val and no parenthesized suffix', () => {
    expect(nodeDisplayValue({ label: 'JustName', fields: {} })).toBe('JustName');
  });

  it('handles nested parentheses in fallback', () => {
    expect(nodeDisplayValue({ label: 'Tree(val)', fields: {} })).toBe('val');
  });
});

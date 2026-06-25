import { describe, it, expect } from 'vitest';
import { getArrayLayout } from '../../../../components/CanvasArea/layouts/array';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, fields: Record<string, unknown> = {}, pointers: string[] = []): HeapStructure['nodes'][number] {
  return { addr, label: 'arr', fields, pointers_pointing_here: pointers };
}

describe('getArrayLayout', () => {
  it('returns null for empty nodes', () => {
    const s: HeapStructure = { annotation_name: 'a', structure_type: 'array', root_node_addr: '', nodes: [], edges: [], cycle_detected: false };
    expect(getArrayLayout(s, CANVAS)).toBeNull();
  });

  it('positions single element', () => {
    const s: HeapStructure = { annotation_name: 'a', structure_type: 'array', root_node_addr: '0x1', nodes: [makeNode('0x1', { val: '5' })], edges: [], cycle_detected: false };
    const result = getArrayLayout(s, CANVAS)!;
    expect(result).not.toBeNull();
    expect(result.positions['0x1']).toBeDefined();
    expect(result.positions['0x1'].cx).toBeGreaterThan(result.positions['0x1'].x);
  });

  it('positions multiple elements in a row', () => {
    const nodes = [makeNode('0x1'), makeNode('0x2'), makeNode('0x3')];
    const s: HeapStructure = { annotation_name: 'a', structure_type: 'array', root_node_addr: '0x1', nodes, edges: [], cycle_detected: false };
    const result = getArrayLayout(s, CANVAS)!;
    // Each subsequent element should have larger x
    expect(result.positions['0x2'].x).toBeGreaterThan(result.positions['0x1'].x);
    expect(result.positions['0x3'].x).toBeGreaterThan(result.positions['0x2'].x);
    // Same y for all elements
    expect(result.positions['0x1'].y).toBe(result.positions['0x2'].y);
  });

  it('bounds cover all positions', () => {
    const nodes = [makeNode('0x1'), makeNode('0x2')];
    const s: HeapStructure = { annotation_name: 'a', structure_type: 'array', root_node_addr: '0x1', nodes, edges: [], cycle_detected: false };
    const result = getArrayLayout(s, CANVAS)!;
    expect(result.bounds.minX).toBeLessThanOrEqual(result.positions['0x1'].x);
    expect(result.bounds.maxX).toBeGreaterThanOrEqual(result.positions['0x2'].x + 72); // ARRAY_CELL_W
  });

  it('includes space for pointer labels', () => {
    const nodes = [makeNode('0x1', {}, ['i']), makeNode('0x2', {}, ['j', 'k'])];
    const s: HeapStructure = { annotation_name: 'a', structure_type: 'array', root_node_addr: '0x1', nodes, edges: [], cycle_detected: false };
    const result = getArrayLayout(s, CANVAS)!;
    // bottomExtra should be larger with pointers
    expect(result.bounds.maxY).toBeGreaterThan(result.positions['0x1'].y + 32);
  });
});

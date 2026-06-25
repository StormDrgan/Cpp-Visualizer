import { describe, it, expect } from 'vitest';
import { getStackLayout } from '../../../../components/CanvasArea/layouts/stack';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, pointers: string[] = []): HeapStructure['nodes'][number] {
  return { addr, label: 'data', fields: {}, pointers_pointing_here: pointers };
}

function makeStruct(nodes: HeapStructure['nodes']): HeapStructure {
  return { annotation_name: 's', structure_type: 'stack', root_node_addr: nodes[0]?.addr ?? '', nodes, edges: [], cycle_detected: false };
}

describe('getStackLayout', () => {
  it('returns null for empty nodes', () => {
    expect(getStackLayout(makeStruct([]), CANVAS)).toBeNull();
  });

  it('positions single element', () => {
    const result = getStackLayout(makeStruct([makeNode('0x1')]), CANVAS)!;
    expect(result.positions['0x1']).toBeDefined();
  });

  it('stack grows upward (index 0 at bottom)', () => {
    const nodes = [makeNode('0x1'), makeNode('0x2'), makeNode('0x3')];
    const result = getStackLayout(makeStruct(nodes), CANVAS)!;
    // Top of stack (index 2, last pushed) should be above bottom (index 0)
    expect(result.positions['0x2'].y).toBeLessThan(result.positions['0x1'].y);
    // Same x (vertical column)
    expect(result.positions['0x1'].x).toBe(result.positions['0x2'].x);
  });

  it('includes pointer label space in bounds', () => {
    const nodes = [makeNode('0x1', ['top'])];
    const result = getStackLayout(makeStruct(nodes), CANVAS)!;
    // rightExtra with pointers
    expect(result.bounds.maxX).toBeGreaterThan(result.positions['0x1'].x + 60);
  });
});

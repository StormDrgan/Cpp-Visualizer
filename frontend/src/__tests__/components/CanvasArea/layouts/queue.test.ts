import { describe, it, expect } from 'vitest';
import { getQueueLayout } from '../../../../components/CanvasArea/layouts/queue';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, pointers: string[] = []): HeapStructure['nodes'][number] {
  return { addr, label: 'q', fields: {}, pointers_pointing_here: pointers };
}

function makeStruct(nodes: HeapStructure['nodes']): HeapStructure {
  return { annotation_name: 'q', structure_type: 'queue', root_node_addr: nodes[0]?.addr ?? '', nodes, edges: [], cycle_detected: false };
}

describe('getQueueLayout', () => {
  it('returns null for empty nodes', () => {
    expect(getQueueLayout(makeStruct([]), CANVAS)).toBeNull();
  });

  it('positions single element', () => {
    const result = getQueueLayout(makeStruct([makeNode('0x1')]), CANVAS)!;
    expect(result.positions['0x1']).toBeDefined();
  });

  it('positions elements in a horizontal row', () => {
    const nodes = [makeNode('0x1'), makeNode('0x2'), makeNode('0x3')];
    const result = getQueueLayout(makeStruct(nodes), CANVAS)!;
    expect(result.positions['0x2'].x).toBeGreaterThan(result.positions['0x1'].x);
    expect(result.positions['0x3'].x).toBeGreaterThan(result.positions['0x2'].x);
  });

  it('includes pointer label space in bounds', () => {
    const nodes = [makeNode('0x1', ['front']), makeNode('0x2', ['rear'])];
    const result = getQueueLayout(makeStruct(nodes), CANVAS)!;
    expect(result.bounds.maxY).toBeGreaterThan(result.positions['0x1'].y + 40);
  });
});

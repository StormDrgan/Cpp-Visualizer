import { describe, it, expect } from 'vitest';
import { getLinkedListLayout } from '../../../../components/CanvasArea/layouts/linkedList';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, fields: Record<string, unknown> = {}, pointers: string[] = []): HeapStructure['nodes'][number] {
  return { addr, label: 'Node', fields, pointers_pointing_here: pointers };
}

function makeStruct(nodes: HeapStructure['nodes']): HeapStructure {
  return { annotation_name: 'list', structure_type: 'linked_list', root_node_addr: nodes[0]?.addr ?? '', nodes, edges: [], cycle_detected: false };
}

describe('getLinkedListLayout', () => {
  it('returns null for empty nodes', () => {
    expect(getLinkedListLayout(makeStruct([]), CANVAS)).toBeNull();
  });

  it('positions single node', () => {
    const result = getLinkedListLayout(makeStruct([makeNode('0x1')]), CANVAS)!;
    expect(result.positions['0x1']).toBeDefined();
    expect(result.positions['0x1'].cx).toBeGreaterThan(result.positions['0x1'].x);
  });

  it('positions nodes in a horizontal row', () => {
    const nodes = [makeNode('0x1'), makeNode('0x2'), makeNode('0x3')];
    const result = getLinkedListLayout(makeStruct(nodes), CANVAS)!;
    expect(result.positions['0x2'].x).toBeGreaterThan(result.positions['0x1'].x);
    expect(result.positions['0x3'].x).toBeGreaterThan(result.positions['0x2'].x);
    // Same y
    expect(result.positions['0x1'].y).toBe(result.positions['0x2'].y);
  });

  it('includes pointer label space in bounds', () => {
    const nodes = [makeNode('0x1', {}, ['head']), makeNode('0x2', {}, ['curr', 'prev'])];
    const result = getLinkedListLayout(makeStruct(nodes), CANVAS)!;
    expect(result.bounds.maxY).toBeGreaterThan(result.positions['0x1'].y + 40);
  });
});

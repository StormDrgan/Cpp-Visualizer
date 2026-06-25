import { describe, it, expect } from 'vitest';
import { getBTreeLayout } from '../../../../components/CanvasArea/layouts/bTree';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, label: string, fields: Record<string, unknown> = {}): HeapStructure['nodes'][number] {
  return { addr, label, fields, pointers_pointing_here: [] };
}

function makeEdge(from: number, to: number, side: string = '0'): { from_idx: number; to_idx: number; child_side: string } {
  return { from_idx: from, to_idx: to, child_side: side };
}

function makeStruct(nodes: HeapStructure['nodes'], edges: HeapStructure['edges'] = []): HeapStructure {
  return {
    annotation_name: 'btree',
    structure_type: 'b_tree',
    root_node_addr: nodes[0]?.addr ?? '',
    nodes,
    edges,
    cycle_detected: false,
  };
}

describe('getBTreeLayout', () => {
  it('returns null for empty nodes', () => {
    expect(getBTreeLayout(makeStruct([]), CANVAS)).toBeNull();
  });

  it('returns layout for single root node', () => {
    const s = makeStruct([makeNode('0x1', 'Root')]);
    const result = getBTreeLayout(s, CANVAS)!;
    expect(result).not.toBeNull();
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].keys).toEqual(['Root']);
  });

  it('splits _keys field for multi-key nodes', () => {
    const s = makeStruct([makeNode('0x1', 'BTreeNode', { _keys: '10|20|30' })]);
    const result = getBTreeLayout(s, CANVAS)!;
    expect(result.layouts[0].keys).toEqual(['10', '20', '30']);
  });

  it('increments y per depth level', () => {
    const nodes = [makeNode('0x1', 'Root'), makeNode('0x2', 'Child')];
    const edges = [makeEdge(0, 1, '0')];
    const result = getBTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    expect(result.layouts).toHaveLength(2);
    // Child should be deeper than root
    expect(result.layouts[1].y).toBeGreaterThan(result.layouts[0].y);
  });

  it('sorts siblings by child_side', () => {
    const nodes = [
      makeNode('0x1', 'Root'),
      makeNode('0x2', 'Key2'),
      makeNode('0x3', 'Key1'),
      makeNode('0x4', 'Key0'),
    ];
    const edges = [
      makeEdge(0, 1, '2'),
      makeEdge(0, 2, '1'),
      makeEdge(0, 3, '0'),
    ];
    const result = getBTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    const depth1Layouts = result.layouts.filter(l => l.y > result.layouts[0].y);
    // Should be sorted by child_side: 0, 1, 2
    const keys = depth1Layouts.map(l => l.keys[0]);
    expect(keys).toEqual(['Key0', 'Key1', 'Key2']);
  });

  it('returns edges unchanged', () => {
    const nodes = [makeNode('0x1', 'Root'), makeNode('0x2', 'Child')];
    const edges = [makeEdge(0, 1, '0')];
    const result = getBTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    expect(result.edges).toEqual(edges);
  });
});

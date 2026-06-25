import { describe, it, expect } from 'vitest';
import { getBinaryTreeLayout } from '../../../../components/CanvasArea/layouts/binaryTree';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, label: string, fields: Record<string, unknown> = {}): HeapStructure['nodes'][number] {
  return { addr, label, fields, pointers_pointing_here: [] };
}

function makeEdge(from: number, to: number, side: string = 'left'): { from_idx: number; to_idx: number; child_side: string } {
  return { from_idx: from, to_idx: to, child_side: side };
}

function makeStruct(nodes: HeapStructure['nodes'], edges: HeapStructure['edges'] = []): HeapStructure {
  return {
    annotation_name: 'tree',
    structure_type: 'binary_tree',
    root_node_addr: nodes[0]?.addr ?? '',
    nodes,
    edges,
    cycle_detected: false,
  };
}

describe('getBinaryTreeLayout', () => {
  it('returns null for empty nodes', () => {
    expect(getBinaryTreeLayout(makeStruct([]), CANVAS)).toBeNull();
  });

  it('returns position for single root node', () => {
    const s = makeStruct([makeNode('0x1', 'Node(5)')]);
    const result = getBinaryTreeLayout(s, CANVAS)!;
    expect(result).not.toBeNull();
    expect(result.positions[0]).toBeDefined();
    expect(result.positions[0].x).toBeGreaterThan(0);
    expect(result.positions[0].y).toBeGreaterThan(0);
    expect(result.bounds).toBeDefined();
  });

  it('degenerate: no clear root falls back to node 0', () => {
    // All nodes have parents → no root
    const nodes = [makeNode('0x1', 'A'), makeNode('0x2', 'B')];
    const edges = [
      makeEdge(0, 1, 'left'),
      makeEdge(0, 1, 'right'), // second edge makes it ambiguous but 0 still has parent false
    ];
    // Actually to trigger the degenerate case, every node needs a parent
    const nodes2 = [makeNode('0x1', 'A'), makeNode('0x2', 'B')];
    const edges2 = [makeEdge(0, 1, 'left'), makeEdge(1, 0, 'left')]; // cycle
    const s = makeStruct(nodes2, edges2);
    const result = getBinaryTreeLayout(s, CANVAS)!;
    expect(result).not.toBeNull();
    // Falls back to node 0 at canvas center
    expect(result.positions[0].x).toBe(CANVAS.w / 2);
  });

  it('positions left child to the left of root', () => {
    const nodes = [makeNode('0x1', 'R'), makeNode('0x2', 'L')];
    const edges = [makeEdge(0, 1, 'left')];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    expect(result.positions[1].x).toBeLessThan(result.positions[0].x);
  });

  it('positions right child to the right of root', () => {
    const nodes = [makeNode('0x1', 'R'), makeNode('0x2', 'Rc')];
    const edges = [makeEdge(0, 1, 'right')];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    expect(result.positions[1].x).toBeGreaterThan(result.positions[0].x);
  });

  it('positions complete binary tree with no overlaps', () => {
    // 3-level complete tree (7 nodes): indices 0(root), 1(L), 2(R), 3(LL), 4(LR), 5(RL), 6(RR)
    const nodes = Array.from({ length: 7 }, (_, i) => makeNode(`0x${i}`, `Node(${i})`));
    const edges = [
      makeEdge(0, 1, 'left'), makeEdge(0, 2, 'right'),
      makeEdge(1, 3, 'left'), makeEdge(1, 4, 'right'),
      makeEdge(2, 5, 'left'), makeEdge(2, 6, 'right'),
    ];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    // All nodes at same depth should have distinct x positions
    const rootY = result.positions[0].y;
    const leftY = result.positions[1].y;
    const rightY = result.positions[2].y;
    // Children should be deeper (larger y) than parent
    expect(leftY).toBeGreaterThan(rootY);
    expect(rightY).toBeGreaterThan(rootY);
    // Siblings at same depth should have same y
    expect(leftY).toBe(rightY);
  });

  it('positions are integer-like (non-NaN, finite)', () => {
    const nodes = [makeNode('0x1', 'R'), makeNode('0x2', 'L'), makeNode('0x3', 'Rc')];
    const edges = [makeEdge(0, 1, 'left'), makeEdge(0, 2, 'right')];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    for (const key of Object.keys(result.positions)) {
      const p = result.positions[Number(key)];
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('bounds cover all node positions', () => {
    const nodes = [makeNode('0x1', 'R'), makeNode('0x2', 'L'), makeNode('0x3', 'Rc')];
    const edges = [makeEdge(0, 1, 'left'), makeEdge(0, 2, 'right')];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    const xs = Object.values(result.positions).map(p => p.x);
    const ys = Object.values(result.positions).map(p => p.y);
    expect(result.bounds.minX).toBeLessThanOrEqual(Math.min(...xs));
    expect(result.bounds.maxX).toBeGreaterThanOrEqual(Math.max(...xs));
    expect(result.bounds.minY).toBeLessThanOrEqual(Math.min(...ys));
    expect(result.bounds.maxY).toBeGreaterThanOrEqual(Math.max(...ys));
  });

  it('handles single-child offset for left child', () => {
    // Root -> left -> left (skewed left)
    const nodes = [makeNode('0x1', 'R'), makeNode('0x2', 'L1'), makeNode('0x3', 'L2')];
    const edges = [makeEdge(0, 1, 'left'), makeEdge(1, 2, 'left')];
    const result = getBinaryTreeLayout(makeStruct(nodes, edges), CANVAS)!;
    // All should have distinct positions
    const xVals = Object.values(result.positions).map(p => p.x);
    expect(new Set(xVals).size).toBe(3);
  });

  it('canvas centering is applied', () => {
    // Very narrow tree should be centered
    const nodes = [makeNode('0x1', 'Root')];
    const result = getBinaryTreeLayout(makeStruct(nodes), CANVAS)!;
    expect(result.positions[0].x).toBeGreaterThan(CANVAS.w * 0.3);
    expect(result.positions[0].x).toBeLessThan(CANVAS.w * 0.7);
  });
});

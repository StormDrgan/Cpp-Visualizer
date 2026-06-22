import type { HeapStructure } from '../../../types';
import type { BTLayout } from '../types';
import { TREE_LEVEL_H } from '../constants';

export function getBinaryTreeLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): BTLayout | null {
  const nodes = struct.nodes;
  const edges = struct.edges;
  if (nodes.length === 0) return null;

  // 1. Build children map and find root
  const children: number[][] = Array.from({ length: nodes.length }, () => []);
  const hasParent: boolean[] = new Array(nodes.length).fill(false);
  for (const e of edges) {
    children[e.from_idx].push(e.to_idx);
    hasParent[e.to_idx] = true;
  }

  const rootIdx = hasParent.findIndex((v) => !v);
  if (rootIdx === -1) {
    // Degenerate: no clear root (shouldn't happen), fall back to node 0
    const positions: Record<number, { x: number; y: number }> = {};
    positions[0] = { x: canvasSize.w / 2, y: 30 };
    return { positions, bounds: { minX: canvasSize.w / 2 - 50, maxX: canvasSize.w / 2 + 50, minY: 20, maxY: 80 } };
  }

  // 2. Compute depths via BFS from root
  const depth: number[] = new Array(nodes.length).fill(0);
  const bfsQueue = [rootIdx];
  for (let qi = 0; qi < bfsQueue.length; qi++) {
    const idx = bfsQueue[qi];
    for (const child of children[idx]) {
      depth[child] = depth[idx] + 1;
      bfsQueue.push(child);
    }
  }
  const maxDepth = Math.max(0, ...depth);

  // 3. DFS post-order to assign x positions
  //    Leaf nodes get sequential x slots. Parent x = midpoint of children x's.
  const LEAF_GAP = 64; // minimum spacing between adjacent leaf centers
  let nextLeafX = 0;
  const positions: Record<number, { x: number; y: number }> = {};
  const startY = 30;

  function placeSubtree(idx: number): number {
    const cs = children[idx];
    if (cs.length === 0) {
      // Leaf — assign next available slot
      const x = nextLeafX * LEAF_GAP;
      nextLeafX++;
      positions[idx] = { x, y: startY + depth[idx] * TREE_LEVEL_H };
      return x;
    }

    // Position children first (post-order), collect their x positions
    const childX: number[] = cs.map((c) => placeSubtree(c));

    // Parent x = midpoint of leftmost and rightmost child
    const minX = Math.min(...childX);
    const maxX = Math.max(...childX);
    const x = (minX + maxX) / 2;
    positions[idx] = { x, y: startY + depth[idx] * TREE_LEVEL_H };
    return x;
  }

  placeSubtree(rootIdx);

  // 4. Compute bounds from actual positions
  const allXs = Object.values(positions).map((p) => p.x);
  const minX = Math.min(...allXs) - 60;
  const maxX = Math.max(...allXs) + 60;
  const minY = startY - 10;
  const maxY = startY + maxDepth * TREE_LEVEL_H + 50;

  return { positions, bounds: { minX, maxX, minY, maxY } };
}


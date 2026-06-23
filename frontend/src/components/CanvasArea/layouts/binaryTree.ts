import type { HeapStructure } from '../../../types';
import type { BTLayout } from '../types';
import { TREE_LEVEL_H, TREE_NODE_RADIUS } from '../constants';

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

  // Build map from edge to know left/right for single-child positioning
  const edgeSide: Record<number, Record<number, string>> = {};
  for (const e of edges) {
    if (!edgeSide[e.from_idx]) edgeSide[e.from_idx] = {};
    edgeSide[e.from_idx][e.to_idx] = e.child_side;
  }

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

    if (cs.length === 1) {
      // Single child: offset parent so child leans to its correct side
      const child = cs[0];
      const side = edgeSide[idx]?.[child] ?? '';
      const childXVal = childX[0];
      const offset = LEAF_GAP * 0.6;
      const x = side === 'left' ? childXVal + offset : childXVal - offset;
      positions[idx] = { x, y: startY + depth[idx] * TREE_LEVEL_H };
      return x;
    }

    // Parent x = midpoint of leftmost and rightmost child
    const minX = Math.min(...childX);
    const maxX = Math.max(...childX);
    const x = (minX + maxX) / 2;
    positions[idx] = { x, y: startY + depth[idx] * TREE_LEVEL_H };
    return x;
  }

  placeSubtree(rootIdx);

  // 4. Ensure minimum spacing between nodes at the same depth (prevent overlap)
  const nodesByDepth: number[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (let i = 0; i < nodes.length; i++) {
    nodesByDepth[depth[i]].push(i);
  }
  const MIN_NODE_GAP = TREE_NODE_RADIUS * 2 + 16; // minimum center-to-center distance

  for (let d = 0; d <= maxDepth; d++) {
    const row = nodesByDepth[d].sort((a, b) => (positions[a]?.x ?? 0) - (positions[b]?.x ?? 0));
    for (let j = 1; j < row.length; j++) {
      const prev = positions[row[j - 1]];
      const cur = positions[row[j]];
      if (!prev || !cur) continue;
      const gap = cur.x - prev.x;
      if (gap < MIN_NODE_GAP) {
        // Shift current node and all nodes to its right
        const shift = MIN_NODE_GAP - gap;
        for (let k = j; k < row.length; k++) {
          const p = positions[row[k]];
          if (p) p.x += shift;
        }
      }
    }
  }

  // 5. Center the tree within canvas
  const allXs = Object.values(positions).map((p) => p.x);
  const rawMinX = Math.min(...allXs);
  const rawMaxX = Math.max(...allXs);
  const rawMinY = startY;
  const rawMaxY = startY + maxDepth * TREE_LEVEL_H;
  const contentW = rawMaxX - rawMinX;
  const contentH = rawMaxY - rawMinY;
  const offsetX = (canvasSize.w - contentW) / 2 - rawMinX;
  const offsetY = Math.max(30, (canvasSize.h - contentH) / 2 - rawMinY);

  for (const key of Object.keys(positions)) {
    const p = positions[Number(key)];
    p.x += offsetX;
    p.y += offsetY;
  }

  const minX = rawMinX + offsetX - 60;
  const maxX = rawMaxX + offsetX + 60;
  const minY = rawMinY + offsetY - 10;
  const maxY = rawMaxY + offsetY + 50;

  return { positions, bounds: { minX, maxX, minY, maxY } };
}


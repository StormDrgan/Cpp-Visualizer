import type { HeapStructure } from '../../../types';
import type { LLLayout, ContentBounds } from '../types';
import { NODE_W, NODE_GAP, START_X, CENTER_Y, NODE_H, CONTENT_MARGIN } from '../constants';

export function getLinkedListLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): LLLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (NODE_W + NODE_GAP);
    const y = CENTER_Y - NODE_H / 2;
    positions[node.addr] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
  });

  // Calculate pointer label depth
  let maxPtrs = 0;
  for (const n of nodes) {
    maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  }
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + 60, // room for nullptr symbol
    minY: CENTER_Y - NODE_H / 2 - 36, // struct name label above
    maxY: CENTER_Y + NODE_H / 2 + bottomExtra,
  };

  return { positions, startX, bounds };
}


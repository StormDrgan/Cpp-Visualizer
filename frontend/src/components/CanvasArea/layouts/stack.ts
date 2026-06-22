import type { HeapStructure } from '../../../types';
import type { StackLayout, ContentBounds } from '../types';
import { STACK_CELL_W, STACK_CELL_H, STACK_START_X, STACK_START_Y, STACK_GAP, CONTENT_MARGIN } from '../constants';

export function getStackLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): StackLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const startX = STACK_START_X;
  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};

  // Stack grows downward — index 0 at bottom, top at... well, top
  nodes.forEach((node, i) => {
    const x = startX;
    const y = STACK_START_Y + i * (STACK_CELL_H + STACK_GAP);
    positions[node.addr] = { x, y, cx: x + STACK_CELL_W / 2, cy: y + STACK_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  const rightExtra = maxPtrs > 0 ? 60 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + STACK_CELL_W + rightExtra,
    minY: STACK_START_Y - 36,
    maxY: STACK_START_Y + nodes.length * (STACK_CELL_H + STACK_GAP) + 40,
  };

  return { positions, bounds };
}


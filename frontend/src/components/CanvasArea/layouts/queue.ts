import type { HeapStructure } from '../../../types';
import type { QueueLayout, ContentBounds } from '../types';
import { QUEUE_CELL_W, QUEUE_CELL_H, START_X, CONTENT_MARGIN, ARRAY_GAP } from '../constants';

export function getQueueLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): QueueLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * QUEUE_CELL_W + (nodes.length - 1) * ARRAY_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);
  const centerY = Math.max(QUEUE_CELL_H / 2 + 36, canvasSize.h / 2);
  const startY = centerY - QUEUE_CELL_H / 2;

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (QUEUE_CELL_W + ARRAY_GAP);
    const y = startY;
    positions[node.addr] = { x, y, cx: x + QUEUE_CELL_W / 2, cy: y + QUEUE_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + CONTENT_MARGIN,
    minY: startY - 48,
    maxY: startY + QUEUE_CELL_H + 24 + bottomExtra,
  };

  return { positions, startX, bounds };
}


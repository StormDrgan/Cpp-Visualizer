import type { HeapStructure } from '../../../types';
import type { ArrayLayout, ContentBounds } from '../types';
import { ARRAY_CELL_W, ARRAY_GAP, ARRAY_START_Y, ARRAY_CELL_H, CONTENT_MARGIN, START_X } from '../constants';

export function getArrayLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): ArrayLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * ARRAY_CELL_W + (nodes.length - 1) * ARRAY_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (ARRAY_CELL_W + ARRAY_GAP);
    const y = ARRAY_START_Y;
    positions[node.addr] = { x, y, cx: x + ARRAY_CELL_W / 2, cy: y + ARRAY_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) {
    maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  }
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;
  // Extra space for index labels below cells
  const indexLabelExtra = 20;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + CONTENT_MARGIN,
    minY: ARRAY_START_Y - 32,
    maxY: ARRAY_START_Y + ARRAY_CELL_H + indexLabelExtra + bottomExtra,
  };

  return { positions, startX, bounds };
}


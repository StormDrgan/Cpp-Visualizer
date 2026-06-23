import type { HeapStructure } from '../../../types';
import type { BTreeNodeLayout } from '../types';
import { BTREE_KEY_W, BTREE_KEY_H, BTREE_KEY_GAP, BTREE_NODE_PAD, BTREE_LAYER_GAP } from '../constants';

export function getBTreeLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): { layouts: BTreeNodeLayout[]; edges: typeof struct.edges } | null {
  const { nodes, edges } = struct;
  if (nodes.length === 0) return null;

  const depth: number[] = new Array(nodes.length).fill(0);
  const children: number[][] = Array.from({ length: nodes.length }, () => []);

  for (const e of edges) {
    children[e.from_idx].push(e.to_idx);
  }

  const hasParent: boolean[] = new Array(nodes.length).fill(false);
  for (const e of edges) hasParent[e.to_idx] = true;
  const rootIdx = hasParent.findIndex((v) => !v);

  const queue: number[] = [];
  if (rootIdx >= 0) queue.push(rootIdx);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const c of children[cur]) {
      depth[c] = depth[cur] + 1;
      queue.push(c);
    }
  }

  const depthGroups = new Map<number, number[]>();
  let maxDepth = 0;
  for (let i = 0; i < nodes.length; i++) {
    const d = depth[i];
    if (!depthGroups.has(d)) depthGroups.set(d, []);
    depthGroups.get(d)!.push(i);
    maxDepth = Math.max(maxDepth, d);
  }

  const nodeWidths: number[] = [];
  const nodeKeys: string[][] = [];
  for (const node of nodes) {
    const fields = node.fields as Record<string, string>;
    const keysStr = fields._keys || '';
    const keys = keysStr ? keysStr.split('|').filter(Boolean) : [node.label];
    nodeKeys.push(keys);
    const w = Math.max(60, keys.length * (BTREE_KEY_W + BTREE_KEY_GAP) + BTREE_NODE_PAD * 2);
    nodeWidths.push(w);
  }

  const layouts: BTreeNodeLayout[] = [];
  const startY = Math.max(30, (canvasSize.h - (maxDepth + 1) * BTREE_LAYER_GAP) / 2);

  for (let d = 0; d <= maxDepth; d++) {
    const group = depthGroups.get(d) || [];
    if (group.length === 0) continue;

    const y = startY + d * BTREE_LAYER_GAP;
    const totalW = group.reduce((sum, idx) => sum + nodeWidths[idx] + 20, -20);
    let x = Math.max(40, (canvasSize.w - totalW) / 2);

    const sortedGroup = [...group].sort((a, b) => {
      const edgeA = edges.find(e => e.to_idx === a);
      const edgeB = edges.find(e => e.to_idx === b);
      const slotA = parseInt(edgeA?.child_side || '0');
      const slotB = parseInt(edgeB?.child_side || '0');
      return (isNaN(slotA) ? 0 : slotA) - (isNaN(slotB) ? 0 : slotB);
    });

    for (const idx of sortedGroup) {
      layouts.push({ x, y, width: nodeWidths[idx], keys: nodeKeys[idx], addr: nodes[idx].addr });
      x += nodeWidths[idx] + 20;
    }
  }

  return { layouts, edges };
}


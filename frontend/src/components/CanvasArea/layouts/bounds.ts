import type { HeapStructure } from '../../../types';
import type { ContentBounds } from '../types';
import { HMAP_BUCKET_W, HMAP_CHAIN_GAP, TREE_LEVEL_H, TREE_NODE_RADIUS, GRAPH_NODE_RADIUS, GRAPH_RADIUS, BTREE_LAYER_GAP, BTREE_KEY_H, BTREE_NODE_PAD } from '../constants';
import { getLinkedListLayout } from './linkedList';
import { getBinaryTreeLayout } from './binaryTree';
import { getArrayLayout } from './array';
import { getStackLayout } from './stack';
import { getQueueLayout } from './queue';
import { getBTreeLayout } from './bTree';

export function getStructBounds(struct: HeapStructure, canvasSize: { w: number; h: number }): ContentBounds {
  const hasNext = struct.nodes.some(
    (n) => typeof (n.fields as Record<string, string>)?.next === 'string',
  );
  const type = struct.structure_type;
  const emptyBounds: ContentBounds = { minX: 0, maxX: 150, minY: 0, maxY: 60 };

  if (type === 'binary_tree' || type === 'heap') {
    const layout = getBinaryTreeLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'array') {
    const layout = getArrayLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'stack') {
    // All stacks use vertical layout (sequential + linked)
    const layout = getStackLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'queue' && !hasNext) {
    const layout = getQueueLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'queue') {
    const layout = getLinkedListLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'graph') {
    const n = struct.nodes.length;
    if (n === 0) return emptyBounds;
    return { minX: 20, maxX: 20 + n * 100 + 100, minY: 20, maxY: 20 + n * 70 + 100 };
  }
  if (type === 'hashmap') {
    const n = struct.nodes.length;
    if (n === 0) return emptyBounds;
    return {
      minX: 20,
      maxX: 20 + n * (HMAP_BUCKET_W + 8) + HMAP_CHAIN_GAP * 3 + 100,
      minY: 20,
      maxY: 20 + 200 + 100,
    };
  }
  if (type === 'b_tree' || type === 'bplustree') {
    const layout = getBTreeLayout(struct, canvasSize);
    if (!layout) return emptyBounds;
    const maxX = Math.max(...layout.layouts.map(l => l.x + l.width)) + 40;
    const maxY = Math.max(...layout.layouts.map(l => l.y)) + BTREE_KEY_H + BTREE_NODE_PAD * 2 + 40;
    return { minX: 20, maxX: Math.max(maxX, 200), minY: 10, maxY: Math.max(maxY, 80) };
  }
  // linked_list (default)
  const layout = getLinkedListLayout(struct, canvasSize);
  return layout?.bounds ?? emptyBounds;
}


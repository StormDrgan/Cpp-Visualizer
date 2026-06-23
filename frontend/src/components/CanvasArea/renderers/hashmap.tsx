import { Fragment } from 'react';
import { Rect, Text, Arrow, Group } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { HMAP_BUCKET_W, HMAP_BUCKET_H, HMAP_CHAIN_GAP, NODE_W, NODE_H } from '../constants';
import { nodeDisplayValue } from '../utils';

export function renderHashmap(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
      </Group>
    );
  }

  const elements: React.ReactNode[] = [];

  // Separate bucket nodes from chain nodes
  // Bucket nodes have an index field and are first in the array
  const bucketNodes = nodes.filter(n => {
    const fields = n.fields as Record<string, string>;
    return fields.bucket_idx !== undefined;
  });

  // If no bucket nodes (flat structure), treat all as buckets
  const allBuckets = bucketNodes.length > 0 ? bucketNodes : nodes;
  const chainNodes = bucketNodes.length > 0
    ? nodes.filter(n => (n.fields as Record<string, string>).bucket_idx === undefined)
    : [];

  const startX = Math.max(40, (canvasSize.w - allBuckets.length * (HMAP_BUCKET_W + 8)) / 2);
  const startY = Math.max(30, (canvasSize.h - allBuckets.length * 60) / 2);

  // Layout buckets horizontally
  const bucketPositions: Map<string, { x: number; y: number; cx: number; cy: number }> = new Map();
  allBuckets.forEach((node, i) => {
    const x = startX + i * (HMAP_BUCKET_W + 8);
    const y = startY;
    bucketPositions.set(node.addr, { x, y, cx: x + HMAP_BUCKET_W / 2, cy: y + HMAP_BUCKET_H / 2 });
    const fields = node.fields as Record<string, string>;
    const idx = fields.bucket_idx ?? fields.index ?? String(i);

    elements.push(
      <Group key={`hmap-bucket-${node.addr}`} name={`node-${node.addr}`}>
        <Rect name={`rect-${node.addr}`}
          x={x} y={y} width={HMAP_BUCKET_W} height={HMAP_BUCKET_H}
          cornerRadius={4} fill="#fff" stroke="#7986cb" strokeWidth={2}
        />
        <Text text={`[${idx}]`}
          x={x + 4} y={y + 2} width={36} height={16}
          fontSize={10} fill="#7986cb" fontStyle="bold"
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x + 36} y={y + 2} width={HMAP_BUCKET_W - 44} height={16}
          align="right" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#333"
        />
      </Group>
    );
  });

  // Layout chain nodes below their parent buckets
  // Use edges to determine which chain nodes belong to which bucket
  const bucketChains: Map<string, { addr: string; x: number; y: number; cx: number; cy: number }[]> = new Map();

  // Process edges to build chains
  edges.forEach((edge) => {
    const fromIdx = edge.from_idx;
    const toIdx = edge.to_idx;
    if (fromIdx < nodes.length && toIdx < nodes.length) {
      const fromNode = nodes[fromIdx];
      const toNode = nodes[toIdx];
      const fromPos = bucketPositions.get(fromNode.addr);
      if (fromPos) {
        // from is a bucket — add chain node
        const chain = bucketChains.get(fromNode.addr) ?? [];
        const chainIdx = chain.length;
        const cy = fromPos.y + HMAP_BUCKET_H + 18 + chainIdx * (NODE_H + 6);
        chain.push({
          addr: toNode.addr,
          x: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP,
          y: cy - NODE_H / 2,
          cx: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP + NODE_W / 2,
          cy,
        });
        bucketChains.set(fromNode.addr, chain);

        // Arrow from bucket to first chain node, or chain-to-chain
        const prevAddr = chainIdx > 0 ? chain[chainIdx - 1].addr : fromNode.addr;
        const prevNode = chainIdx > 0
          ? { addr: prevAddr, x: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP,
              cx: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP + NODE_W / 2,
              y: fromPos.y + HMAP_BUCKET_H + 18 + (chainIdx - 1) * (NODE_H + 6) - NODE_H / 2,
              cy: fromPos.y + HMAP_BUCKET_H + 18 + (chainIdx - 1) * (NODE_H + 6) }
          : { addr: fromNode.addr, x: fromPos.x, cx: fromPos.cx, y: fromPos.y, cy: fromPos.cy };
      }
    }
  });

  // Render chain nodes with arrows
  bucketChains.forEach((chain, bucketAddr) => {
    const bucketPos = bucketPositions.get(bucketAddr);
    if (!bucketPos) return;

    chain.forEach((chainNode, ci) => {
      elements.push(
        <Group key={`hmap-chain-${chainNode.addr}`} name={`node-${chainNode.addr}`}>
          <Rect name={`rect-${chainNode.addr}`} x={chainNode.x} y={chainNode.y} width={NODE_W} height={NODE_H}
            cornerRadius={6} fill="#fff" stroke="#c0c0c0" strokeWidth={1}
          />
          <Text name={`label-${chainNode.addr}`}
            text={nodeDisplayValue({ label: nodes.find(n => n.addr === chainNode.addr)?.label ?? '', fields: nodes.find(n => n.addr === chainNode.addr)?.fields ?? {} })}
            x={chainNode.x} y={chainNode.y} width={NODE_W} height={NODE_H}
            align="center" verticalAlign="middle" fontSize={14} fontStyle="bold" fill="#333"
          />
        </Group>
      );

      // Arrow
      const fromPos = ci === 0 ? bucketPos : chain[ci - 1];
      if (fromPos) {
        elements.push(
          <Arrow key={`hmap-arrow-${bucketAddr}-${ci}`}
            points={[fromPos.cx + (ci === 0 ? HMAP_BUCKET_W / 2 : NODE_W / 2) + 4,
                     fromPos.cy,
                     chainNode.cx - NODE_W / 2 - 4,
                     chainNode.cy]}
            pointerLength={8} pointerWidth={8} fill="#888" stroke="#888" strokeWidth={1.5}
          />
        );
      }
    });
  });

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


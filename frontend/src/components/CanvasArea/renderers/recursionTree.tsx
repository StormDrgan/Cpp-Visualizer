import { Fragment } from 'react';
import { Rect, Text, Arrow, Group } from 'react-konva';
import type { HeapStructure } from '../../../types';

export function renderRecursionTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (!nodes || nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
      </Group>
    );
  }

  const NODE_W = 120;
  const NODE_H = 40;
  const DEPTH_GAP = 70;
  const X_GAP = 30;

  const elements: React.ReactNode[] = [];
  const depthMap = new Map<number, { x: number; y: number; addr: string }[]>();

  // Layout: root at top, each depth level below
  nodes.forEach((node) => {
    const depth = parseInt((node.fields as Record<string, string>).depth ?? '0');
    const status = (node.fields as Record<string, string>).status ?? 'active';
    if (!depthMap.has(depth)) depthMap.set(depth, []);
    const row = depthMap.get(depth)!;
    const x = canvasSize.w / 2 - NODE_W / 2 - (nodes.length * (NODE_W + X_GAP)) / 2 + row.length * (NODE_W + X_GAP);
    const y = 40 + depth * DEPTH_GAP;

    const isActive = status !== 'returned';
    elements.push(
      <Group key={`rec-node-${node.addr}`} name={`node-${node.addr}`} x={x} y={y}>
        <Rect name={`rect-${node.addr}`}
          width={NODE_W} height={NODE_H}
          cornerRadius={6}
          fill={isActive ? '#e0f7fa' : '#f5f5f5'}
          stroke={isActive ? '#00838f' : '#ccc'}
          strokeWidth={isActive ? 2 : 1}
          opacity={isActive ? 1 : 0.5}
        />
        <Text name={`label-${node.addr}`}
          text={(node.fields as Record<string, string>).function ?? node.label}
          x={0} y={0} width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle"
          fontSize={12} fontStyle="bold"
          fill={isActive ? '#333' : '#999'}
        />
      </Group>
    );
    row.push({ x, y, addr: node.addr });
  });

  // Edges: parent -> child arrows
  if (edges && edges.length > 0) {
    edges.forEach((edge) => {
      const parent = nodes[edge.from_idx];
      const child = nodes[edge.to_idx];
      if (!parent || !child) return;
      // Find positions from depth map
      let parentPos: { x: number; y: number } | null = null;
      let childPos: { x: number; y: number } | null = null;
      for (const [, row] of depthMap) {
        for (const item of row) {
          if (item.addr === parent.addr) parentPos = item;
          if (item.addr === child.addr) childPos = item;
        }
      }
      if (!parentPos || !childPos) return;
      elements.push(
        <Arrow
          key={`rec-arrow-${edge.from_idx}-${edge.to_idx}`}
          points={[
            parentPos.x + NODE_W / 2, parentPos.y + NODE_H,
            childPos.x + NODE_W / 2, childPos.y,
          ]}
          pointerLength={6} pointerWidth={6}
          fill="#888" stroke="#888" strokeWidth={1.5}
        />
      );
    });
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


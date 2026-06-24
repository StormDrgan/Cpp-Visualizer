import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Circle, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  TREE_LEVEL_H,
  TREE_NODE_RADIUS,
  NODE_FILL,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  NODE_POINTED_FILL,
  NODE_POINTED_STROKE,
  EDGE_STROKE,
  EDGE_WIDTH,
  CANVAS_TEXT_FILL,
  CANVAS_TEXT_TERTIARY,
  CANVAS_FONT,
  EMPTY_FILL,
  EMPTY_STROKE,
} from '../constants';

export function renderHeap(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  // Build a virtual binary tree from array indices (0-based)
  const { nodes } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fill={CANVAS_TEXT_TERTIARY} fontStyle="bold" fontFamily={CANVAS_FONT} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill={CANVAS_TEXT_TERTIARY} align="center" fontFamily={CANVAS_FONT} />
      </Group>
    );
  }

  // Compute depth for each node using heap property: child at 2i+1, 2i+2
  const depth: number[] = nodes.map((_, i) => {
    let d = 0;
    let idx = i;
    while (idx > 0) { idx = Math.floor((idx - 1) / 2); d++; }
    return d;
  });
  const maxDepth = Math.max(...depth);

  // Group by depth
  const nodesByDepth: number[][] = Array.from({ length: maxDepth + 1 }, () => []);
  depth.forEach((d, i) => nodesByDepth[d].push(i));

  // Position nodes
  const positions: { x: number; y: number }[] = [];
  const startY = Math.max(30, (canvasSize.h - (maxDepth + 1) * TREE_LEVEL_H) / 2);
  const usableWidth = canvasSize.w - 60;

  for (let level = 0; level <= maxDepth; level++) {
    const count = nodesByDepth[level].length;
    const gap = count > 1 ? Math.min(100, usableWidth / (count + 1)) : 0;
    const totalWidth = count > 1 ? (count - 1) * gap : 0;
    const startX = (canvasSize.w - totalWidth) / 2;

    nodesByDepth[level].forEach((nodeIdx, i) => {
      positions[nodeIdx] = {
        x: count === 1 ? canvasSize.w / 2 : startX + i * gap,
        y: startY + level * TREE_LEVEL_H,
      };
    });
  }

  const elements: React.ReactNode[] = [];

  // Edges from parent to children
  for (let i = 0; i < nodes.length; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < nodes.length && positions[i] && positions[left]) {
      elements.push(
        <Arrow key={`heap-edge-${i}-l`}
          points={[positions[i].x, positions[i].y + TREE_NODE_RADIUS,
                   positions[left].x, positions[left].y - TREE_NODE_RADIUS]}
          pointerLength={6} pointerWidth={6} fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
        />
      );
    }
    if (right < nodes.length && positions[i] && positions[right]) {
      elements.push(
        <Arrow key={`heap-edge-${i}-r`}
          points={[positions[i].x, positions[i].y + TREE_NODE_RADIUS,
                   positions[right].x, positions[right].y - TREE_NODE_RADIUS]}
          pointerLength={6} pointerWidth={6} fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
        />
      );
    }
  }

  // Nodes as circles
  nodes.forEach((node, i) => {
    const pos = positions[i];
    if (!pos) return;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`heap-node-${node.addr}`} name={`node-${node.addr}`}
        x={pos.x} y={pos.y}>
        <Circle name={`rect-${node.addr}`} radius={TREE_NODE_RADIUS}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={-TREE_NODE_RADIUS} y={-6} width={TREE_NODE_RADIUS * 2} height={16}
          align="center" verticalAlign="middle" fontSize={13} fontStyle="bold" fill={CANVAS_TEXT_FILL}
          fontFamily={CANVAS_FONT}
        />
      </Group>
    );
  });

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

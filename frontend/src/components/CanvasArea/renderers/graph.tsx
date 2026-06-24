import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Circle } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  GRAPH_NODE_RADIUS,
  GRAPH_RADIUS,
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

export function renderGraph(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fill={CANVAS_TEXT_TERTIARY} fontStyle="bold" fontFamily={CANVAS_FONT} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill={CANVAS_TEXT_TERTIARY} align="center" fontFamily={CANVAS_FONT} />
      </Group>
    );
  }

  // Circular layout for graph vertices — centered in viewport
  const cx = canvasSize.w / 2;
  const cy = canvasSize.h / 2;
  const radius = Math.min(GRAPH_RADIUS, Math.min(canvasSize.w, canvasSize.h) * 0.35);
  const vertexCount = nodes.length;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (2 * Math.PI * i) / vertexCount - Math.PI / 2;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  const elements: React.ReactNode[] = [];

  // Edges with arrows
  edges.forEach((edge, i) => {
    const from = positions[edge.from_idx];
    const to = positions[edge.to_idx];
    if (!from || !to) return;

    // Compute line with offset from circle boundary
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const startX = from.x + nx * GRAPH_NODE_RADIUS;
    const startY = from.y + ny * GRAPH_NODE_RADIUS;
    const endX = to.x - nx * GRAPH_NODE_RADIUS;
    const endY = to.y - ny * GRAPH_NODE_RADIUS;

    elements.push(
      <Arrow key={`graph-edge-${i}`}
        points={[startX, startY, endX, endY]}
        pointerLength={8} pointerWidth={8} fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
      />
    );
  });

  // Vertex circles
  nodes.forEach((node, i) => {
    const pos = positions[i];
    if (!pos) return;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`graph-node-${node.addr}`} name={`node-${node.addr}`}
        x={pos.x} y={pos.y}>
        <Circle name={`rect-${node.addr}`} radius={GRAPH_NODE_RADIUS}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={-GRAPH_NODE_RADIUS} y={-6} width={GRAPH_NODE_RADIUS * 2} height={16}
          align="center" verticalAlign="middle" fontSize={13} fontStyle="bold" fill={CANVAS_TEXT_FILL}
          fontFamily={CANVAS_FONT}
        />
      </Group>
    );
  });

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

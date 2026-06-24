import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  NODE_W, NODE_H, NODE_GAP, NODE_RADIUS, START_X, CONTENT_MARGIN,
  NODE_FILL, NODE_STROKE, NODE_STROKE_WIDTH,
  NODE_POINTED_FILL, NODE_POINTED_STROKE,
  EDGE_STROKE, EDGE_WIDTH,
  POINTER_LINE_COLOR, POINTER_TAG_FILL, POINTER_TAG_STROKE,
  POINTER_TEXT_COLOR, POINTER_FONT_SIZE,
  CANVAS_TEXT_FILL, CANVAS_TEXT_TERTIARY, CANVAS_FONT,
  EMPTY_FILL, EMPTY_STROKE,
} from '../constants';
import { nodeDisplayValue } from '../utils';
import { getLinkedListLayout } from '../layouts/linkedList';

export function renderLinkedList(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getLinkedListLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 30} y={canvasSize.h / 2 - 20}>
        <Rect width={60} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={60} height={40} align="center" verticalAlign="middle" fontSize={11} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_TERTIARY} />
        <Text text={struct.annotation_name} x={30} y={45} fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_TERTIARY} align="center" />
      </Group>
    );
  }

  const { positions, startX } = layout;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];

  // Arrows between nodes
  const isDoubly = !!struct.prev_field;
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = positions[nodes[i].addr];
    const to = positions[nodes[i + 1].addr];
    // Forward arrow (top)
    elements.push(
      <Arrow
        key={`arrow-fwd-${i}`}
        points={[from.cx + NODE_W / 2 + 4, from.cy, to.cx - NODE_W / 2 - 4, to.cy]}
        pointerLength={8} pointerWidth={8}
        fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
      />
    );
    // Backward arrow for doubly linked list (bottom, reversed direction)
    if (isDoubly) {
      elements.push(
        <Arrow
          key={`arrow-bwd-${i}`}
          points={[to.cx - NODE_W / 2 - 4, to.cy + 8, from.cx + NODE_W / 2 + 4, from.cy + 8]}
          pointerLength={8} pointerWidth={8}
          fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
        />
      );
    }
  }

  // Last node → nullptr
  if (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    const lp = positions[last.addr];
    elements.push(
      <Text key="nullptr" text="∅"
        x={lp.cx + NODE_W / 2 + 12} y={lp.cy - 8}
        fontSize={16} fill={CANVAS_TEXT_TERTIARY} fontStyle="bold"
      />
    );
  }

  // Node rectangles + labels — v0.8: show only value, centered like array cells
  nodes.forEach((node) => {
    const { x, y } = positions[node.addr];
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group
        key={`node-${node.addr}`}
        name={`node-${node.addr}`}
      >
        <Rect
          name={`rect-${node.addr}`}
          x={x} y={y}
          width={NODE_W} height={NODE_H}
          cornerRadius={NODE_RADIUS}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text
          name={`label-${node.addr}`}
          text={nodeDisplayValue(node)}
          x={x} y={y}
          width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle"
          fontSize={14} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_FILL}
        />
      </Group>
    );
  });

  // Pointer labels (below nodes)
  nodes.forEach((node) => {
    const ptrs = node.pointers_pointing_here;
    if (ptrs.length === 0) return;
    const pos = positions[node.addr];
    if (!pos) return;
    const { cx, y } = pos;
    const nodeBottom = y + NODE_H;

    ptrs.forEach((ptr, pi) => {
      const labelY = nodeBottom + 14 + pi * 20;

      elements.push(
        <Line
          key={`ptr-line-${node.addr}-${ptr}`}
          points={[cx, nodeBottom, cx, labelY - 4]}
          stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
        />
      );
      elements.push(
        <Rect
          key={`ptr-bg-${node.addr}-${ptr}`}
          x={cx - 24} y={labelY - 2}
          width={48} height={18} cornerRadius={3}
          fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
        />
      );
      elements.push(
        <Text
          key={`ptr-text-${node.addr}-${ptr}`}
          text={ptr}
          x={cx - 24} y={labelY - 2}
          width={48} height={18}
          align="center" verticalAlign="middle"
          fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
        />
      );
    });
  });

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

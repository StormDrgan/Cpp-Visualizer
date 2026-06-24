import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  NODE_W, NODE_H, NODE_RADIUS, STACK_CELL_W, STACK_CELL_H, STACK_GAP,
  NODE_FILL, NODE_STROKE, NODE_STROKE_WIDTH,
  NODE_POINTED_FILL, NODE_POINTED_STROKE,
  EDGE_STROKE, EDGE_WIDTH,
  POINTER_LINE_COLOR, POINTER_TAG_FILL, POINTER_TAG_STROKE,
  POINTER_TEXT_COLOR, POINTER_FONT_SIZE,
  CANVAS_TEXT_FILL, CANVAS_TEXT_SECONDARY, CANVAS_TEXT_TERTIARY, CANVAS_FONT,
  EMPTY_FILL, EMPTY_STROKE,
} from '../constants';
import { nodeDisplayValue } from '../utils';
import { getStackLayout } from '../layouts/stack';

export function renderStack(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  // Linked stack? Check if nodes have 'next' field (pointer-based)
  const isLinked = struct.nodes.length > 0 &&
    typeof (struct.nodes[0].fields as Record<string, string>)?.next === 'string';

  if (isLinked) {
    return renderLinkedStack(struct, canvasSize);
  }
  return renderSequentialStack(struct, canvasSize);
}


export function renderSequentialStack(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getStackLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_TERTIARY} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_TERTIARY} align="center" />
      </Group>
    );
  }

  const { positions } = layout;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];

  // Draw cells from bottom to top (index 0 at bottom)
  nodes.forEach((node, i) => {
    const { x, y, cx } = positions[node.addr];
    const hasPointers = node.pointers_pointing_here.length > 0;

    // Stack plate (wider plate look)
    elements.push(
      <Group key={`stack-node-${node.addr}`} name={`node-${node.addr}`}>
        <Rect
          name={`rect-${node.addr}`}
          x={x} y={y}
          width={STACK_CELL_W} height={STACK_CELL_H}
          cornerRadius={3}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y}
          width={STACK_CELL_W} height={STACK_CELL_H}
          align="center" verticalAlign="middle"
          fontSize={13} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_FILL}
        />
        <Text
          text={`[${i}]`}
          x={x + STACK_CELL_W - 32} y={y + STACK_CELL_H - 16}
          width={28} height={12}
          align="center" verticalAlign="middle"
          fontSize={9} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_SECONDARY}
        />
      </Group>
    );
  });

  // Top of stack indicator — arrow from above pointing down to the top element
  if (nodes.length > 0) {
    const topNode = nodes[nodes.length - 1];
    const topPos = positions[topNode.addr];
    if (topPos) {
      const labelY = topPos.y - 26;
      elements.push(
        <Fragment key="top-indicator">
          <Line
            points={[topPos.cx, labelY + 14, topPos.cx, topPos.y]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect
            x={topPos.cx - 14} y={labelY}
            width={28} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="top" x={topPos.cx - 14} y={labelY}
            width={28} height={16}
            align="center" verticalAlign="middle"
            fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
  }


  return <Group key={struct.annotation_name}>{elements}</Group>;
}


export function renderLinkedStack(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_TERTIARY} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_TERTIARY} align="center" />
      </Group>
    );
  }

  // Vertical layout: stack grows upward — last node (top) at smallest y
  const startX = canvasSize.w / 2 - NODE_W / 2;
  const vGap = NODE_H + 16;
  const totalH = nodes.length * NODE_H + (nodes.length - 1) * vGap;
  const startY = Math.max(50, (canvasSize.h - totalH) / 2);

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  // Linked list walker returns nodes head→tail (top→bottom).
  // Top (last pushed) at smallest y, bottom (first pushed) at largest y.
  nodes.forEach((node, i) => {
    const x = startX;
    const y = startY + i * vGap;
    positions[node.addr] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
  });

  const elements: React.ReactNode[] = [];

  // Arrows between nodes (downward, from top to bottom)
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = positions[nodes[i].addr];
    const to = positions[nodes[i + 1].addr];
    if (from && to) {
      elements.push(
        <Arrow
          key={`arrow-${i}`}
          points={[from.cx, from.y + NODE_H + 2, to.cx, to.y - 2]}
          pointerLength={8} pointerWidth={8}
          fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
        />
      );
    }
  }

  // Node rectangles
  nodes.forEach((node) => {
    const pos = positions[node.addr];
    if (!pos) return;
    const { x, y } = pos;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`ls-node-${node.addr}`} name={`node-${node.addr}`}>
        <Rect name={`rect-${node.addr}`} x={x} y={y} width={NODE_W} height={NODE_H} cornerRadius={NODE_RADIUS}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text name={`label-${node.addr}`} text={nodeDisplayValue(node)}
          x={x} y={y} width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle" fontSize={14} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_FILL}
        />
      </Group>
    );
  });

  // "top" label — linked list head is the stack top (nodes[0])
  if (nodes.length > 0) {
    const topNode = nodes[0];
    const topPos = positions[topNode.addr];
    if (topPos) {
      const labelY = topPos.y - 26;
      elements.push(
        <Fragment key="top-label">
          <Line
            points={[topPos.cx, labelY + 14, topPos.cx, topPos.y]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect x={topPos.cx - 14} y={labelY} width={28} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="top" x={topPos.cx - 14} y={labelY} width={28} height={16}
            align="center" verticalAlign="middle" fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

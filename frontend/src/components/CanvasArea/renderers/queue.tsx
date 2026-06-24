import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  NODE_W, NODE_H, NODE_GAP, NODE_RADIUS, START_X, QUEUE_CELL_W, QUEUE_CELL_H,
  NODE_FILL, NODE_STROKE, NODE_STROKE_WIDTH,
  NODE_POINTED_FILL, NODE_POINTED_STROKE,
  EDGE_STROKE, EDGE_WIDTH,
  POINTER_LINE_COLOR, POINTER_TAG_FILL, POINTER_TAG_STROKE,
  POINTER_TEXT_COLOR, POINTER_FONT_SIZE,
  CANVAS_TEXT_FILL, CANVAS_TEXT_SECONDARY, CANVAS_TEXT_TERTIARY, CANVAS_FONT,
  EMPTY_FILL, EMPTY_STROKE,
} from '../constants';
import { nodeDisplayValue } from '../utils';
import { getLinkedListLayout } from '../layouts/linkedList';
import { getQueueLayout } from '../layouts/queue';

export function renderQueue(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const isLinked = struct.nodes.length > 0 &&
    typeof (struct.nodes[0].fields as Record<string, string>)?.next === 'string';

  if (isLinked) {
    return renderLinkedQueue(struct, canvasSize);
  }
  return renderCircularQueue(struct, canvasSize);
}


export function renderCircularQueue(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getQueueLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_TERTIARY} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_TERTIARY} align="center" />
      </Group>
    );
  }

  const { positions, startX } = layout;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];

  nodes.forEach((node) => {
    const { x, y } = positions[node.addr];
    const hasPointers = node.pointers_pointing_here.length > 0;
    const fields = node.fields as Record<string, string>;
    const idx = fields.index ?? '';

    elements.push(
      <Group key={`q-node-${node.addr}`} name={`node-${node.addr}`}>
        <Rect
          name={`rect-${node.addr}`}
          x={x} y={y}
          width={QUEUE_CELL_W} height={QUEUE_CELL_H}
          cornerRadius={4}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x} y={y} width={QUEUE_CELL_W} height={QUEUE_CELL_H}
          align="center" verticalAlign="middle" fontSize={14} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_FILL}
        />
        <Text text={`[${idx}]`}
          x={x} y={y + QUEUE_CELL_H + 2} width={QUEUE_CELL_W} height={16}
          align="center" verticalAlign="middle" fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_SECONDARY}
        />
      </Group>
    );
  });

  // front/rear labels over the first/last nodes with pointers
  if (nodes.length > 0) {
    const frontNode = nodes[0];
    const lastNode = nodes[nodes.length - 1];
    const frontPos = positions[frontNode.addr];
    const rearPos = positions[lastNode.addr];
    if (frontPos) {
      elements.push(
        <Fragment key="front-label">
          <Line points={[frontPos.cx, frontPos.y - 16, frontPos.cx, frontPos.y - 4]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect x={frontPos.cx - 20} y={frontPos.y - 32} width={40} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="front" x={frontPos.cx - 20} y={frontPos.y - 32} width={40} height={16}
            align="center" verticalAlign="middle" fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
    if (rearPos && rearPos !== frontPos) {
      elements.push(
        <Fragment key="rear-label">
          <Line points={[rearPos.cx, rearPos.y - 16, rearPos.cx, rearPos.y - 4]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect x={rearPos.cx - 18} y={rearPos.y - 32} width={36} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="rear" x={rearPos.cx - 18} y={rearPos.y - 32} width={36} height={16}
            align="center" verticalAlign="middle" fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
  }


  return <Group key={struct.annotation_name}>{elements}</Group>;
}


export function renderLinkedQueue(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getLinkedListLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_TERTIARY} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_TERTIARY} align="center" />
      </Group>
    );
  }

  const { positions, startX } = layout;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];

  // Arrows between nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = positions[nodes[i].addr];
    const to = positions[nodes[i + 1].addr];
    if (from && to) {
      elements.push(
        <Arrow key={`arrow-${i}`}
          points={[from.cx + NODE_W / 2 + 4, from.cy, to.cx - NODE_W / 2 - 4, to.cy]}
          pointerLength={8} pointerWidth={8} fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
        />
      );
    }
  }

  // Nodes
  nodes.forEach((node) => {
    const pos = positions[node.addr];
    if (!pos) return;
    const { x, y } = pos;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`lq-node-${node.addr}`} name={`node-${node.addr}`}>
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

  // front/rear labels
  if (nodes.length > 0) {
    const firstPos = positions[nodes[0].addr];
    const lastPos = positions[nodes[nodes.length - 1].addr];
    if (firstPos) {
      elements.push(
        <Fragment key="front-label">
          <Line points={[firstPos.cx, firstPos.y - 16, firstPos.cx, firstPos.y - 4]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect x={firstPos.cx - 20} y={firstPos.y - 32} width={40} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="front" x={firstPos.cx - 20} y={firstPos.y - 32} width={40} height={16}
            align="center" verticalAlign="middle" fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
    if (lastPos && lastPos !== firstPos) {
      elements.push(
        <Fragment key="rear-label">
          <Line points={[lastPos.cx, lastPos.y - 16, lastPos.cx, lastPos.y - 4]}
            stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
          />
          <Rect x={lastPos.cx - 18} y={lastPos.y - 32} width={36} height={16} cornerRadius={3}
            fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
          />
          <Text text="rear" x={lastPos.cx - 18} y={lastPos.y - 32} width={36} height={16}
            align="center" verticalAlign="middle" fontSize={POINTER_FONT_SIZE} fontFamily={CANVAS_FONT} fontStyle="bold" fill={POINTER_TEXT_COLOR}
          />
        </Fragment>
      );
    }
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

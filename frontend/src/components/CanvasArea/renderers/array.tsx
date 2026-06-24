import { Fragment } from 'react';
import { Rect, Text, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  ARRAY_CELL_W, ARRAY_CELL_H, ARRAY_GAP,
  NODE_FILL, NODE_STROKE, NODE_STROKE_WIDTH,
  NODE_POINTED_FILL, NODE_POINTED_STROKE,
  POINTER_LINE_COLOR, POINTER_TAG_FILL, POINTER_TAG_STROKE,
  POINTER_TEXT_COLOR, POINTER_FONT_SIZE,
  CANVAS_TEXT_FILL, CANVAS_TEXT_SECONDARY, CANVAS_TEXT_TERTIARY, CANVAS_FONT,
  EMPTY_FILL, EMPTY_STROKE,
} from '../constants';
import { getArrayLayout } from '../layouts/array';

export function renderArray(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getArrayLayout(struct, canvasSize);
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

  // Cell rectangles + value labels + index labels
  nodes.forEach((node) => {
    const { x, y, cx } = positions[node.addr];
    const hasPointers = node.pointers_pointing_here.length > 0;
    const idx = (node.fields as Record<string, string>).index ?? '';

    elements.push(
      <Group
        key={`arr-node-${node.addr}`}
        name={`node-${node.addr}`}
      >
        <Rect
          name={`rect-${node.addr}`}
          x={x} y={y}
          width={ARRAY_CELL_W} height={ARRAY_CELL_H}
          cornerRadius={4}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y}
          width={ARRAY_CELL_W} height={ARRAY_CELL_H}
          align="center" verticalAlign="middle"
          fontSize={14} fontFamily={CANVAS_FONT} fontStyle="bold" fill={CANVAS_TEXT_FILL}
        />
        {/* Index label below cell */}
        <Text
          text={`[${idx}]`}
          x={x} y={y + ARRAY_CELL_H + 2}
          width={ARRAY_CELL_W} height={16}
          align="center" verticalAlign="middle"
          fontSize={10} fontFamily={CANVAS_FONT} fill={CANVAS_TEXT_SECONDARY}
        />
      </Group>
    );
  });

  // Pointer labels (below index labels)
  nodes.forEach((node) => {
    const ptrs = node.pointers_pointing_here;
    if (ptrs.length === 0) return;
    const pos = positions[node.addr];
    if (!pos) return;
    const { cx, y } = pos;
    const cellBottom = y + ARRAY_CELL_H;

    ptrs.forEach((ptr, pi) => {
      const labelY = cellBottom + 22 + pi * 20;

      elements.push(
        <Line
          key={`ptr-line-${node.addr}-${ptr}`}
          points={[cx, cellBottom + 18, cx, labelY - 4]}
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

import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line, Circle } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  TREE_NODE_RADIUS,
  NODE_FILL,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  NODE_POINTED_FILL,
  NODE_POINTED_STROKE,
  EDGE_STROKE,
  EDGE_WIDTH,
  POINTER_LINE_COLOR,
  POINTER_TAG_FILL,
  POINTER_TAG_STROKE,
  POINTER_TEXT_COLOR,
  POINTER_FONT_SIZE,
  CANVAS_TEXT_FILL,
  CANVAS_TEXT_TERTIARY,
  CANVAS_FONT,
  EMPTY_FILL,
  EMPTY_STROKE,
} from '../constants';
import { getBinaryTreeLayout } from '../layouts/binaryTree';

export function renderBinaryTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getBinaryTreeLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fill={CANVAS_TEXT_TERTIARY} fontStyle="bold" fontFamily={CANVAS_FONT} />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill={CANVAS_TEXT_TERTIARY} align="center" fontFamily={CANVAS_FONT} />
      </Group>
    );
  }

  const { positions } = layout;
  const { nodes, edges } = struct;
  const elements: React.ReactNode[] = [];

  // Edges
  edges.forEach((edge, i) => {
    const parent = positions[edge.from_idx];
    const child = positions[edge.to_idx];
    if (!parent || !child) return;
    elements.push(
      <Arrow
        key={`tree-edge-${i}`}
        points={[parent.x, parent.y + TREE_NODE_RADIUS, child.x, child.y - TREE_NODE_RADIUS]}
        pointerLength={7} pointerWidth={7}
        fill={EDGE_STROKE} stroke={EDGE_STROKE} strokeWidth={EDGE_WIDTH}
      />
    );
  });

  // Nodes as circles
  nodes.forEach((node, i) => {
    const pos = positions[i];
    if (!pos) return;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group
        key={`tree-node-${node.addr}`}
        name={`node-${node.addr}`}
        x={pos.x} y={pos.y}
      >
        <Circle
          name={`rect-${node.addr}`}
          radius={TREE_NODE_RADIUS}
          fill={hasPointers ? NODE_POINTED_FILL : NODE_FILL}
          stroke={hasPointers ? NODE_POINTED_STROKE : NODE_STROKE}
          strokeWidth={NODE_STROKE_WIDTH}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={-TREE_NODE_RADIUS} y={-10}
          width={TREE_NODE_RADIUS * 2} height={20}
          align="center" verticalAlign="middle"
          fontSize={13} fontStyle="bold" fill={CANVAS_TEXT_FILL}
          fontFamily={CANVAS_FONT}
        />
        {/* Pointer labels — inside the node Group so they move with the node */}
        {node.pointers_pointing_here.map((ptr, pi) => {
          const labelY = TREE_NODE_RADIUS + 8 + pi * 18;
          return (
            <Fragment key={`ptr-${node.addr}-${ptr}`}>
              <Line
                points={[0, TREE_NODE_RADIUS, 0, labelY - 2]}
                stroke={POINTER_LINE_COLOR} strokeWidth={1} dash={[3, 3]}
              />
              <Rect
                x={-24} y={labelY}
                width={48} height={16} cornerRadius={3}
                fill={POINTER_TAG_FILL} stroke={POINTER_TAG_STROKE} strokeWidth={1}
              />
              <Text
                text={ptr}
                x={-24} y={labelY}
                width={48} height={16}
                align="center" verticalAlign="middle"
                fontSize={POINTER_FONT_SIZE} fontStyle="bold" fill={POINTER_TEXT_COLOR}
                fontFamily={CANVAS_FONT}
              />
            </Fragment>
          );
        })}
      </Group>
    );
  });


  return <Group key={struct.annotation_name}>{elements}</Group>;
}

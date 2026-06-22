import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { NODE_W, NODE_H, NODE_GAP, NODE_RADIUS, START_X, CENTER_Y, STACK_CELL_W, STACK_CELL_H, STACK_START_X, STACK_START_Y, STACK_GAP } from '../constants';
import { nodeDisplayValue } from '../utils';
import { getLinkedListLayout } from '../layouts/linkedList';
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
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
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
          fill={hasPointers ? '#fff3e0' : '#fafafa'}
          stroke={hasPointers ? '#e65100' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(230,81,0,0.12)' : 'transparent'}
          shadowBlur={4}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y}
          width={STACK_CELL_W} height={STACK_CELL_H}
          align="center" verticalAlign="middle"
          fontSize={13} fontStyle="bold" fill="#333"
        />
        <Text
          text={`[${i}]`}
          x={x + STACK_CELL_W - 32} y={y + STACK_CELL_H - 16}
          width={28} height={12}
          align="center" verticalAlign="middle"
          fontSize={9} fill="#ccc"
        />
      </Group>
    );
  });

  // Top of stack indicator (arrow pointing to the last element)
  if (nodes.length > 0) {
    const topNode = nodes[nodes.length - 1];
    const topPos = positions[topNode.addr];
    if (topPos) {
      const arrowX = topPos.x + STACK_CELL_W + 12;
      const arrowY = topPos.cy;
      elements.push(
        <Fragment key="top-indicator">
          <Line
            points={[topPos.x + STACK_CELL_W, topPos.cy, arrowX, arrowY]}
            stroke="#e65100" strokeWidth={1.5}
          />
          <Arrow
            points={[arrowX - 2, arrowY - 6, arrowX, arrowY, arrowX + 6, arrowY - 6]}
            fill="#e65100" stroke="#e65100" strokeWidth={1.5}
            pointerLength={6} pointerWidth={6}
          />
          <Text text="top" x={arrowX + 6} y={arrowY - 9}
            fontSize={10} fill="#e65100" fontStyle="bold"
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
  // Reuse linked list layout with "top" label instead of "head"
  const layout = getLinkedListLayout(struct, canvasSize);
  if (!layout) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
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
        <Arrow
          key={`arrow-${i}`}
          points={[from.cx + NODE_W / 2 + 4, from.cy, to.cx - NODE_W / 2 - 4, to.cy]}
          pointerLength={8} pointerWidth={8}
          fill="#888" stroke="#888" strokeWidth={2}
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
          fill={hasPointers ? '#fff3e0' : '#fafafa'}
          stroke={hasPointers ? '#e65100' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(230,81,0,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={nodeDisplayValue(node)}
          x={x} y={y} width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle" fontSize={14} fontStyle="bold" fill="#333"
        />
      </Group>
    );
  });

  // "top" label pointing to first node
  if (nodes.length > 0) {
    const topPos = positions[nodes[0].addr];
    if (topPos) {
      elements.push(
        <Fragment key="top-label">
          <Line points={[topPos.cx, topPos.y - 18, topPos.cx, topPos.y - 4]}
            stroke="#e65100" strokeWidth={1.5} dash={[3, 3]}
          />
          <Rect x={topPos.cx - 16} y={topPos.y - 34} width={32} height={16} cornerRadius={3}
            fill="#fff3e0" stroke="#e65100" strokeWidth={1}
          />
          <Text text="top" x={topPos.cx - 16} y={topPos.y - 34} width={32} height={16}
            align="center" verticalAlign="middle" fontSize={10} fontStyle="bold" fill="#e65100"
          />
        </Fragment>
      );
    }
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { NODE_W, NODE_H, NODE_GAP, NODE_RADIUS, START_X, CONTENT_MARGIN } from '../constants';
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
        <Rect width={60} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="NULL" x={0} y={0} width={60} height={40} align="center" verticalAlign="middle" fontSize={13} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={30} y={45} fontSize={11} fill="#bbb" align="center" />
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
        points={[from.cx + NODE_W / 2 + 4, from.cy - 6, to.cx - NODE_W / 2 - 4, to.cy - 6]}
        pointerLength={8} pointerWidth={8}
        fill="#888" stroke="#888" strokeWidth={2}
      />
    );
    // Backward arrow for doubly linked list (bottom, reversed direction)
    if (isDoubly) {
      elements.push(
        <Arrow
          key={`arrow-bwd-${i}`}
          points={[to.cx - NODE_W / 2 - 4, to.cy + 6, from.cx + NODE_W / 2 + 4, from.cy + 6]}
          pointerLength={8} pointerWidth={8}
          fill="#bbb" stroke="#bbb" strokeWidth={2}
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
        fontSize={16} fill="#bbb" fontStyle="bold"
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
          fill={hasPointers ? '#e3f2fd' : '#fafafa'}
          stroke={hasPointers ? '#1a73e8' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(26,115,232,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        <Text
          name={`label-${node.addr}`}
          text={nodeDisplayValue(node)}
          x={x} y={y}
          width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle"
          fontSize={14} fontStyle="bold" fill="#333"
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
          stroke="#e65100" strokeWidth={1} dash={[3, 3]}
        />
      );
      elements.push(
        <Rect
          key={`ptr-bg-${node.addr}-${ptr}`}
          x={cx - 24} y={labelY - 2}
          width={48} height={18} cornerRadius={3}
          fill="#fff3e0" stroke="#e65100" strokeWidth={1}
        />
      );
      elements.push(
        <Text
          key={`ptr-text-${node.addr}-${ptr}`}
          text={ptr}
          x={cx - 24} y={labelY - 2}
          width={48} height={18}
          align="center" verticalAlign="middle"
          fontSize={10} fontStyle="bold" fill="#e65100"
        />
      );
    });
  });

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


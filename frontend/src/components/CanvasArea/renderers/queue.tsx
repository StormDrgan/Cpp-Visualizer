import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { NODE_W, NODE_H, NODE_GAP, NODE_RADIUS, START_X, CENTER_Y, QUEUE_CELL_W, QUEUE_CELL_H } from '../constants';
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
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
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
          fill={hasPointers ? '#e8eaf6' : '#fafafa'}
          stroke={hasPointers ? '#3949ab' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(57,73,171,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x} y={y} width={QUEUE_CELL_W} height={QUEUE_CELL_H}
          align="center" verticalAlign="middle" fontSize={14} fontStyle="bold" fill="#333"
        />
        <Text text={`[${idx}]`}
          x={x} y={y + QUEUE_CELL_H + 2} width={QUEUE_CELL_W} height={16}
          align="center" verticalAlign="middle" fontSize={10} fill="#aaa"
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
            stroke="#1a73e8" strokeWidth={1.5} dash={[3, 3]}
          />
          <Rect x={frontPos.cx - 20} y={frontPos.y - 32} width={40} height={16} cornerRadius={3}
            fill="#e3f2fd" stroke="#1a73e8" strokeWidth={1}
          />
          <Text text="front" x={frontPos.cx - 20} y={frontPos.y - 32} width={40} height={16}
            align="center" verticalAlign="middle" fontSize={10} fontStyle="bold" fill="#1a73e8"
          />
        </Fragment>
      );
    }
    if (rearPos && rearPos !== frontPos) {
      elements.push(
        <Fragment key="rear-label">
          <Line points={[rearPos.cx, rearPos.y - 16, rearPos.cx, rearPos.y - 4]}
            stroke="#e65100" strokeWidth={1.5} dash={[3, 3]}
          />
          <Rect x={rearPos.cx - 18} y={rearPos.y - 32} width={36} height={16} cornerRadius={3}
            fill="#fff3e0" stroke="#e65100" strokeWidth={1}
          />
          <Text text="rear" x={rearPos.cx - 18} y={rearPos.y - 32} width={36} height={16}
            align="center" verticalAlign="middle" fontSize={10} fontStyle="bold" fill="#e65100"
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
        <Arrow key={`arrow-${i}`}
          points={[from.cx + NODE_W / 2 + 4, from.cy, to.cx - NODE_W / 2 - 4, to.cy]}
          pointerLength={8} pointerWidth={8} fill="#888" stroke="#888" strokeWidth={2}
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
          fill={hasPointers ? '#e8eaf6' : '#fafafa'}
          stroke={hasPointers ? '#3949ab' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(57,73,171,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={nodeDisplayValue(node)}
          x={x} y={y} width={NODE_W} height={NODE_H}
          align="center" verticalAlign="middle" fontSize={14} fontStyle="bold" fill="#333"
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
            stroke="#1a73e8" strokeWidth={1.5} dash={[3, 3]}
          />
          <Rect x={firstPos.cx - 20} y={firstPos.y - 32} width={40} height={16} cornerRadius={3}
            fill="#e3f2fd" stroke="#1a73e8" strokeWidth={1}
          />
          <Text text="front" x={firstPos.cx - 20} y={firstPos.y - 32} width={40} height={16}
            align="center" verticalAlign="middle" fontSize={10} fontStyle="bold" fill="#1a73e8"
          />
        </Fragment>
      );
    }
    if (lastPos && lastPos !== firstPos) {
      elements.push(
        <Fragment key="rear-label">
          <Line points={[lastPos.cx, lastPos.y - 16, lastPos.cx, lastPos.y - 4]}
            stroke="#e65100" strokeWidth={1.5} dash={[3, 3]}
          />
          <Rect x={lastPos.cx - 18} y={lastPos.y - 32} width={36} height={16} cornerRadius={3}
            fill="#fff3e0" stroke="#e65100" strokeWidth={1}
          />
          <Text text="rear" x={lastPos.cx - 18} y={lastPos.y - 32} width={36} height={16}
            align="center" verticalAlign="middle" fontSize={10} fontStyle="bold" fill="#e65100"
          />
        </Fragment>
      );
    }
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


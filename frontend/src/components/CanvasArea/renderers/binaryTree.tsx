import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line, Circle } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { TREE_NODE_RADIUS } from '../constants';
import { getBinaryTreeLayout } from '../layouts/binaryTree';

export function renderBinaryTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getBinaryTreeLayout(struct, canvasSize);
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
        fill="#888" stroke="#888" strokeWidth={1.5}
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
          fill={hasPointers ? '#e8f5e9' : '#fafafa'}
          stroke={hasPointers ? '#2e7d32' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2.5 : 1.5}
          shadowColor={hasPointers ? 'rgba(46,125,50,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={-TREE_NODE_RADIUS} y={-10}
          width={TREE_NODE_RADIUS * 2} height={20}
          align="center" verticalAlign="middle"
          fontSize={13} fontStyle="bold" fill="#333"
        />
      </Group>
    );

    // Pointer labels
    const ptrs = node.pointers_pointing_here;
    ptrs.forEach((ptr, pi) => {
      const labelY = TREE_NODE_RADIUS + 8 + pi * 18;
      elements.push(
        <Line
          key={`ptr-line-${node.addr}-${ptr}`}
          points={[0, TREE_NODE_RADIUS, 0, labelY - 2]}
          stroke="#e65100" strokeWidth={1} dash={[3, 3]}
        />
      );
      elements.push(
        <Rect
          key={`ptr-bg-${node.addr}-${ptr}`}
          x={-24} y={labelY}
          width={48} height={16} cornerRadius={3}
          fill="#fff3e0" stroke="#e65100" strokeWidth={1}
        />
      );
      elements.push(
        <Text
          key={`ptr-text-${node.addr}-${ptr}`}
          text={ptr}
          x={-24} y={labelY}
          width={48} height={16}
          align="center" verticalAlign="middle"
          fontSize={9} fontStyle="bold" fill="#e65100"
        />
      );
    });
  });


  return <Group key={struct.annotation_name}>{elements}</Group>;
}


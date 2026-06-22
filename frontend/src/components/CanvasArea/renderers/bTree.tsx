import { Fragment } from 'react';
import { Rect, Text, Arrow, Group } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { BTREE_KEY_W, BTREE_KEY_H, BTREE_KEY_GAP, BTREE_NODE_PAD, BTREE_LAYER_GAP } from '../constants';
import { getBTreeLayout } from '../layouts/bTree';

export function renderBTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const result = getBTreeLayout(struct, canvasSize);
  if (!result) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
      </Group>
    );
  }

  const { layouts, edges } = result;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];
  const nodeH = BTREE_KEY_H + BTREE_NODE_PAD * 2;

  for (const edge of edges) {
    const parentLayout = layouts.find(l => l.addr === nodes[edge.from_idx]?.addr);
    const childLayout = layouts.find(l => l.addr === nodes[edge.to_idx]?.addr);
    if (!parentLayout || !childLayout) continue;

    const childSlot = parseInt(edge.child_side || '0');
    const parentKeys = parentLayout.keys.length;
    const arrowFromX = parentLayout.x + BTREE_NODE_PAD +
      (childSlot > 0 ? childSlot * (BTREE_KEY_W + BTREE_KEY_GAP) - BTREE_KEY_GAP / 2 : BTREE_KEY_W / 2);
    const arrowFromY = parentLayout.y + nodeH;

    elements.push(
      <Arrow
        key={`bt-arrow-${edge.from_idx}-${edge.to_idx}`}
        points={[arrowFromX, arrowFromY, childLayout.x + childLayout.width / 2, childLayout.y]}
        pointerLength={6} pointerWidth={6}
        fill="#8d6e63" stroke="#8d6e63" strokeWidth={1.5}
      />
    );
  }

  for (const layout of layouts) {
    const node = nodes.find(n => n.addr === layout.addr);
    const hasPointers = node ? node.pointers_pointing_here.length > 0 : false;

    elements.push(
      <Group key={`bt-node-${layout.addr}`} name={`node-${layout.addr}`}>
        <Rect
          name={`rect-${layout.addr}`}
          x={layout.x} y={layout.y}
          width={layout.width} height={nodeH}
          cornerRadius={6}
          fill={hasPointers ? '#efebe9' : '#fafafa'}
          stroke={hasPointers ? '#6d4c41' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(109,76,65,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        {layout.keys.map((key, ki) => {
          const kx = layout.x + BTREE_NODE_PAD + ki * (BTREE_KEY_W + BTREE_KEY_GAP);
          const ky = layout.y + BTREE_NODE_PAD;
          return (
            <Group key={`bt-key-${layout.addr}-${ki}`}>
              <Rect
                x={kx} y={ky}
                width={BTREE_KEY_W} height={BTREE_KEY_H}
                cornerRadius={3}
                fill={hasPointers ? '#d7ccc8' : '#f5f5f5'}
                stroke={hasPointers ? '#8d6e63' : '#e0e0e0'}
                strokeWidth={1}
              />
              <Text
                text={key}
                x={kx} y={ky}
                width={BTREE_KEY_W} height={BTREE_KEY_H}
                align="center" verticalAlign="middle"
                fontSize={12} fontStyle="bold" fill="#333"
              />
            </Group>
          );
        })}
      </Group>
    );
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


export function renderBPlusTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const result = getBTreeLayout(struct, canvasSize);
  if (!result) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
      </Group>
    );
  }

  const { layouts, edges } = result;
  const { nodes } = struct;
  const elements: React.ReactNode[] = [];
  const nodeH = BTREE_KEY_H + BTREE_NODE_PAD * 2;

  for (const edge of edges) {
    const parentLayout = layouts.find(l => l.addr === nodes[edge.from_idx]?.addr);
    const childLayout = layouts.find(l => l.addr === nodes[edge.to_idx]?.addr);
    if (!parentLayout || !childLayout) continue;

    const childSlot = parseInt(edge.child_side || '0');
    const arrowFromX = parentLayout.x + BTREE_NODE_PAD +
      (childSlot > 0 ? childSlot * (BTREE_KEY_W + BTREE_KEY_GAP) - BTREE_KEY_GAP / 2 : BTREE_KEY_W / 2);
    const arrowFromY = parentLayout.y + nodeH;

    elements.push(
      <Arrow
        key={`bpt-arrow-${edge.from_idx}-${edge.to_idx}`}
        points={[arrowFromX, arrowFromY, childLayout.x + childLayout.width / 2, childLayout.y]}
        pointerLength={6} pointerWidth={6}
        fill="#689f38" stroke="#689f38" strokeWidth={1.5}
      />
    );
  }

  // Sibling arrows between leaf nodes (B+tree specific)
  const leafLayouts = layouts.filter(l => {
    const node = nodes.find(n => n.addr === l.addr);
    return node && (node.fields as Record<string, string>)._is_leaf === 'true';
  });
  leafLayouts.sort((a, b) => a.x - b.x);
  for (let i = 0; i < leafLayouts.length - 1; i++) {
    const from = leafLayouts[i];
    const to = leafLayouts[i + 1];
    elements.push(
      <Arrow
        key={`bpt-sibling-${i}`}
        points={[from.x + from.width, from.y + nodeH / 2, to.x, to.y + nodeH / 2]}
        pointerLength={5} pointerWidth={5}
        fill="#aed581" stroke="#aed581" strokeWidth={1.5}
        dash={[4, 3]}
      />
    );
  }

  for (const layout of layouts) {
    const node = nodes.find(n => n.addr === layout.addr);
    const hasPointers = node ? node.pointers_pointing_here.length > 0 : false;

    elements.push(
      <Group key={`bpt-node-${layout.addr}`} name={`node-${layout.addr}`}>
        <Rect
          name={`rect-${layout.addr}`}
          x={layout.x} y={layout.y}
          width={layout.width} height={nodeH}
          cornerRadius={6}
          fill={hasPointers ? '#f1f8e9' : '#fafafa'}
          stroke={hasPointers ? '#558b2f' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(85,139,47,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        {layout.keys.map((key, ki) => {
          const kx = layout.x + BTREE_NODE_PAD + ki * (BTREE_KEY_W + BTREE_KEY_GAP);
          const ky = layout.y + BTREE_NODE_PAD;
          return (
            <Group key={`bpt-key-${layout.addr}-${ki}`}>
              <Rect
                x={kx} y={ky}
                width={BTREE_KEY_W} height={BTREE_KEY_H}
                cornerRadius={3}
                fill={hasPointers ? '#dcedc8' : '#f5f5f5'}
                stroke={hasPointers ? '#aed581' : '#e0e0e0'}
                strokeWidth={1}
              />
              <Text
                text={key}
                x={kx} y={ky}
                width={BTREE_KEY_W} height={BTREE_KEY_H}
                align="center" verticalAlign="middle"
                fontSize={12} fontStyle="bold" fill="#333"
              />
            </Group>
          );
        })}
      </Group>
    );
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}


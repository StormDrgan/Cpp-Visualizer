import { Fragment } from 'react';
import { Rect, Text, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import { ARRAY_CELL_W, ARRAY_CELL_H, ARRAY_GAP } from '../constants';
import { getArrayLayout } from '../layouts/array';

export function renderArray(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const layout = getArrayLayout(struct, canvasSize);
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
          fill={hasPointers ? '#e0f2f1' : '#fafafa'}
          stroke={hasPointers ? '#00897b' : '#d0d0d0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(0,137,123,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y}
          width={ARRAY_CELL_W} height={ARRAY_CELL_H}
          align="center" verticalAlign="middle"
          fontSize={14} fontStyle="bold" fill="#333"
        />
        {/* Index label below cell */}
        <Text
          text={`[${idx}]`}
          x={x} y={y + ARRAY_CELL_H + 2}
          width={ARRAY_CELL_W} height={16}
          align="center" verticalAlign="middle"
          fontSize={10} fill="#aaa"
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


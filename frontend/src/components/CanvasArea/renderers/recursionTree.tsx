import { Fragment } from 'react';
import { Rect, Text, Arrow, Group, Line } from 'react-konva';
import type { HeapStructure } from '../../../types';
import {
  NODE_ACTIVE_FILL,
  NODE_ACTIVE_STROKE,
  EDGE_STROKE,
  EDGE_WIDTH,
  CANVAS_TEXT_FILL,
  CANVAS_TEXT_TERTIARY,
  CANVAS_FONT,
  EMPTY_FILL,
  EMPTY_STROKE,
} from '../constants';

const NODE_W = 130;
const NODE_H = 36;
const DEPTH_GAP = 64;
const NODE_RADIUS = 8;

export function renderRecursionTree(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (!nodes || nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill={EMPTY_FILL} stroke={EMPTY_STROKE} strokeWidth={1} dash={[4, 3]} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={11} fill={CANVAS_TEXT_TERTIARY} fontStyle="bold" fontFamily={CANVAS_FONT} />
      </Group>
    );
  }

  // ── 1. 按 depth 分组，计算每层节点数 ──
  const depthMap = new Map<number, { addr: string; funcName: string; status: string; line: string }[]>();
  let maxDepth = 0;
  let minDepth = Infinity;

  nodes.forEach((node) => {
    const fields = node.fields as Record<string, string>;
    const depth = parseInt(fields.depth ?? '0');
    const status = fields.status ?? 'active';
    const funcName = fields.function ?? node.label;
    const line = fields.line ?? '';

    if (!depthMap.has(depth)) depthMap.set(depth, []);
    depthMap.get(depth)!.push({ addr: node.addr, funcName, status, line });

    if (depth > maxDepth) maxDepth = depth;
    if (depth < minDepth) minDepth = depth;
  });

  // ── 2. 计算最大行宽（用于居中）──
  let maxRowWidth = 0;
  depthMap.forEach((row) => {
    const w = row.length * NODE_W + (row.length - 1) * 20;
    if (w > maxRowWidth) maxRowWidth = w;
  });

  // ── 3. 计算垂直范围 ──
  const totalDepth = maxDepth - minDepth + 1;
  const totalH = totalDepth * DEPTH_GAP;
  const startY = Math.max(24, (canvasSize.h - totalH) / 2);

  // ── 4. 布局：每层居中 ──
  const nodePositions = new Map<string, { x: number; y: number; cx: number; cy: number }>();
  const depthKeys = Array.from(depthMap.keys()).sort((a, b) => a - b);

  depthKeys.forEach((depth, di) => {
    const row = depthMap.get(depth)!;
    const rowWidth = row.length * NODE_W + (row.length - 1) * 20;
    const rowStartX = canvasSize.w / 2 - rowWidth / 2;
    const y = startY + di * DEPTH_GAP;

    row.forEach((item, ri) => {
      const x = rowStartX + ri * (NODE_W + 20);
      nodePositions.set(item.addr, {
        x,
        y,
        cx: x + NODE_W / 2,
        cy: y + NODE_H / 2,
      });
    });
  });

  // ── 5. 渲染节点 ──
  const elements: React.ReactNode[] = [];

  depthKeys.forEach((depth) => {
    const row = depthMap.get(depth)!;
    row.forEach((item) => {
      const pos = nodePositions.get(item.addr)!;
      const isActive = item.status !== 'returned';

      elements.push(
        <Group key={`rec-node-${item.addr}`} x={pos.x} y={pos.y}>
          <Rect
            width={NODE_W} height={NODE_H}
            cornerRadius={NODE_RADIUS}
            fill={isActive ? NODE_ACTIVE_FILL : EMPTY_FILL}
            stroke={isActive ? NODE_ACTIVE_STROKE : EMPTY_STROKE}
            strokeWidth={isActive ? 2 : 1}
            opacity={isActive ? 1 : 0.5}
          />
          <Text
            text={item.funcName}
            x={0} y={0} width={NODE_W} height={NODE_H}
            align="center" verticalAlign="middle"
            fontSize={12} fontStyle="bold"
            fill={isActive ? CANVAS_TEXT_FILL : CANVAS_TEXT_TERTIARY}
            fontFamily={CANVAS_FONT}
          />
          {/* 行号副文本 */}
          {item.line && item.line !== '0' && (
            <Text
              text={`L${item.line}`}
              x={NODE_W - 36} y={2} width={32} height={14}
              align="right" verticalAlign="top"
              fontSize={9}
              fill={CANVAS_TEXT_TERTIARY}
              fontFamily={CANVAS_FONT}
            />
          )}
          {/* 返回标记 */}
          {!isActive && (
            <Text
              text="↩"
              x={NODE_W - 22} y={NODE_H - 18} width={18} height={16}
              align="center" verticalAlign="middle"
              fontSize={12}
              fill={CANVAS_TEXT_TERTIARY}
              fontFamily={CANVAS_FONT}
            />
          )}
        </Group>
      );
    });
  });

  // ── 6. 渲染边（父→子箭头）──
  // edges: { from_idx, to_idx } 指向 nodes 数组索引
  if (edges && edges.length > 0) {
    // 构建 addr → node 索引映射
    const addrToIdx = new Map<string, number>();
    nodes.forEach((n, i) => addrToIdx.set(n.addr, i));

    edges.forEach((edge) => {
      const parent = nodes[edge.from_idx];
      const child = nodes[edge.to_idx];
      if (!parent || !child) return;

      const parentPos = nodePositions.get(parent.addr);
      const childPos = nodePositions.get(child.addr);
      if (!parentPos || !childPos) return;

      const parentStatus = (parent.fields as Record<string, string>).status ?? 'active';
      const childStatus = (child.fields as Record<string, string>).status ?? 'active';
      const edgeOpacity = (parentStatus === 'returned' && childStatus === 'returned') ? 0.3 : 0.7;

      const startX = parentPos.cx;
      const startY = parentPos.y + NODE_H;
      const endX = childPos.cx;
      const endY = childPos.y;

      // 同列垂直箭头：直线；跨列：折线
      if (Math.abs(startX - endX) < 2) {
        // 直线箭头
        elements.push(
          <Arrow
            key={`rec-arrow-${edge.from_idx}-${edge.to_idx}`}
            points={[startX, startY, endX, endY]}
            pointerLength={8} pointerWidth={8}
            fill={EDGE_STROKE} stroke={EDGE_STROKE}
            strokeWidth={1.5}
            opacity={edgeOpacity}
          />
        );
      } else {
        // 折线：先向下到中间点，再水平
        const midY = (startY + endY) / 2;
        elements.push(
          <Fragment key={`rec-arrow-${edge.from_idx}-${edge.to_idx}`}>
            <Line
              points={[startX, startY, startX, midY, endX, midY, endX, endY]}
              stroke={EDGE_STROKE}
              strokeWidth={1.5}
              opacity={edgeOpacity}
              tension={0.3}
            />
            <Arrow
              points={[endX, endY - 8, endX, endY]}
              pointerLength={6} pointerWidth={6}
              fill={EDGE_STROKE} stroke={EDGE_STROKE}
              strokeWidth={1.5}
              opacity={edgeOpacity}
            />
          </Fragment>
        );
      }
    });
  }

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

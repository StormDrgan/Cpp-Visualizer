import { useRef, useEffect, useState, useMemo, useCallback, Fragment, type MouseEvent as ReactMouseEvent } from 'react';
import { Stage, Layer, Rect, Text, Arrow, Group, Line, Circle } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../store/useStore';
import type { HeapStructure } from '../types';

// Layout constants
const NODE_W = 88;
const NODE_H = 44;
const NODE_GAP = 70;
const NODE_RADIUS = 6;
const START_X = 60;
const CENTER_Y = 160;
const CONTENT_MARGIN = 60;

// Tree layout constants
const TREE_NODE_RADIUS = 20;
const TREE_LEVEL_H = 72;

// Array layout constants
const ARRAY_CELL_W = 72;
const ARRAY_CELL_H = 40;
const ARRAY_GAP = 4;
const ARRAY_START_Y = 130;

// Stack layout constants
const STACK_CELL_W = 88;
const STACK_CELL_H = 36;
const STACK_START_X = 100;
const STACK_START_Y = 36;
const STACK_GAP = 3;

// Queue layout constants
const QUEUE_CELL_W = 72;
const QUEUE_CELL_H = 40;

// Graph layout constants
const GRAPH_NODE_RADIUS = 22;
const GRAPH_CENTER_X = 300;
const GRAPH_CENTER_Y = 200;
const GRAPH_RADIUS = 140;

// Hashmap layout constants
const HMAP_BUCKET_W = 88;
const HMAP_BUCKET_H = 40;
const HMAP_CHAIN_GAP = 60;

// ---- Content bounds type ----
interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ---- Linked-list layout helper ----
interface LLLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}

function getLinkedListLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): LLLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (NODE_W + NODE_GAP);
    const y = CENTER_Y - NODE_H / 2;
    positions[node.addr] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
  });

  // Calculate pointer label depth
  let maxPtrs = 0;
  for (const n of nodes) {
    maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  }
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + 60, // room for nullptr symbol
    minY: CENTER_Y - NODE_H / 2 - 36, // struct name label above
    maxY: CENTER_Y + NODE_H / 2 + bottomExtra,
  };

  return { positions, startX, bounds };
}

// ---- Binary-tree layout helper ----
interface BTLayout {
  positions: Record<number, { x: number; y: number }>;
  bounds: ContentBounds;
}

function getBinaryTreeLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): BTLayout | null {
  const nodes = struct.nodes;
  const edges = struct.edges;
  if (nodes.length === 0) return null;

  // Compute depths via BFS on edges
  const depth: number[] = new Array(nodes.length).fill(0);
  for (const e of edges) {
    depth[e.to_idx] = depth[e.from_idx] + 1;
  }
  const maxDepth = Math.max(0, ...depth);

  // Group by depth
  const nodesByDepth: number[][] = Array.from({ length: maxDepth + 1 }, () => []);
  for (let i = 0; i < nodes.length; i++) {
    nodesByDepth[depth[i]].push(i);
  }

  // Position nodes centered at each level
  const positions: Record<number, { x: number; y: number }> = {};
  const startY = 30;
  const usableWidth = canvasSize.w - 60;

  for (let level = 0; level <= maxDepth; level++) {
    const count = nodesByDepth[level].length;
    const gap = count > 1 ? Math.min(100, usableWidth / (count + 1)) : 0;
    const totalWidth = count > 1 ? (count - 1) * gap : 0;
    const startX = (canvasSize.w - totalWidth) / 2;

    nodesByDepth[level].forEach((nodeIdx, i) => {
      positions[nodeIdx] = {
        x: count === 1 ? canvasSize.w / 2 : startX + i * gap,
        y: startY + level * TREE_LEVEL_H,
      };
    });
  }

  const minX = Math.min(...Object.values(positions).map((p) => p.x)) - 50;
  const maxX = Math.max(...Object.values(positions).map((p) => p.x)) + 50;
  const minY = startY - 10;
  const maxY = startY + maxDepth * TREE_LEVEL_H + 50;

  return { positions, bounds: { minX, maxX, minY, maxY } };
}

// ---- Array layout helper ----
interface ArrayLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}

function getArrayLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): ArrayLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * ARRAY_CELL_W + (nodes.length - 1) * ARRAY_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (ARRAY_CELL_W + ARRAY_GAP);
    const y = ARRAY_START_Y;
    positions[node.addr] = { x, y, cx: x + ARRAY_CELL_W / 2, cy: y + ARRAY_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) {
    maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  }
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;
  // Extra space for index labels below cells
  const indexLabelExtra = 20;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + CONTENT_MARGIN,
    minY: ARRAY_START_Y - 32,
    maxY: ARRAY_START_Y + ARRAY_CELL_H + indexLabelExtra + bottomExtra,
  };

  return { positions, startX, bounds };
}

// ---- Sequential stack layout helper ----
interface StackLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  bounds: ContentBounds;
}

function getStackLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): StackLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const startX = STACK_START_X;
  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};

  // Stack grows downward — index 0 at bottom, top at... well, top
  nodes.forEach((node, i) => {
    const x = startX;
    const y = STACK_START_Y + i * (STACK_CELL_H + STACK_GAP);
    positions[node.addr] = { x, y, cx: x + STACK_CELL_W / 2, cy: y + STACK_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  const rightExtra = maxPtrs > 0 ? 60 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + STACK_CELL_W + rightExtra,
    minY: STACK_START_Y - 36,
    maxY: STACK_START_Y + nodes.length * (STACK_CELL_H + STACK_GAP) + 40,
  };

  return { positions, bounds };
}

// ---- Queue (circular array) layout helper ----
interface QueueLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}

function getQueueLayout(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
): QueueLayout | null {
  const nodes = struct.nodes;
  if (nodes.length === 0) return null;

  const totalWidth = nodes.length * QUEUE_CELL_W + (nodes.length - 1) * ARRAY_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);
  const startY = CENTER_Y - QUEUE_CELL_H / 2;

  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};
  nodes.forEach((node, i) => {
    const x = startX + i * (QUEUE_CELL_W + ARRAY_GAP);
    const y = startY;
    positions[node.addr] = { x, y, cx: x + QUEUE_CELL_W / 2, cy: y + QUEUE_CELL_H / 2 };
  });

  let maxPtrs = 0;
  for (const n of nodes) maxPtrs = Math.max(maxPtrs, n.pointers_pointing_here.length);
  const bottomExtra = maxPtrs > 0 ? 14 + maxPtrs * 20 : 8;

  const bounds: ContentBounds = {
    minX: startX - CONTENT_MARGIN,
    maxX: startX + totalWidth + CONTENT_MARGIN,
    minY: startY - 48,
    maxY: startY + QUEUE_CELL_H + 24 + bottomExtra,
  };

  return { positions, startX, bounds };
}

// ---- Merge bounds ----
function mergeBounds(all: ContentBounds[]): ContentBounds {
  if (all.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  return {
    minX: Math.min(...all.map((b) => b.minX)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
}

// ---- Get bounds for a single structure (null-safe) ----
function getStructBounds(struct: HeapStructure, canvasSize: { w: number; h: number }): ContentBounds {
  const hasNext = struct.nodes.some(
    (n) => typeof (n.fields as Record<string, string>)?.next === 'string',
  );
  const type = struct.structure_type;
  const emptyBounds: ContentBounds = { minX: 0, maxX: 150, minY: 0, maxY: 60 };

  if (type === 'binary_tree' || type === 'heap') {
    const layout = getBinaryTreeLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'array') {
    const layout = getArrayLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'stack' && !hasNext) {
    const layout = getStackLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'queue' && !hasNext) {
    const layout = getQueueLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'queue' || type === 'stack') {
    const layout = getLinkedListLayout(struct, canvasSize);
    return layout?.bounds ?? emptyBounds;
  }
  if (type === 'graph') {
    const n = struct.nodes.length;
    if (n === 0) return emptyBounds;
    return { minX: 20, maxX: 20 + n * 100 + 100, minY: 20, maxY: 20 + n * 70 + 100 };
  }
  if (type === 'hashmap') {
    const n = struct.nodes.length;
    if (n === 0) return emptyBounds;
    return {
      minX: 20,
      maxX: 20 + n * (HMAP_BUCKET_W + 8) + HMAP_CHAIN_GAP * 3 + 100,
      minY: 20,
      maxY: 20 + 200 + 100,
    };
  }
  // linked_list (default)
  const layout = getLinkedListLayout(struct, canvasSize);
  return layout?.bounds ?? emptyBounds;
}

export default function CanvasArea() {
  const snapshot = useStore((s) => s.snapshot);
  const diffActions = useStore((s) => s.diffActions);
  const status = useStore((s) => s.status);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState({ w: 600, h: 320 });

  // Zoom state (Ctrl+wheel zoom kept for future use)
  const [stageScale, setStageScale] = useState(1);

  // Track previously seen actions
  const prevActionsLen = useRef(0);

  // ---- Drag-to-pan state ----
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollStartX: number;
    scrollStartY: number;
  }>({ active: false, startX: 0, startY: 0, scrollStartX: 0, scrollStartY: 0 });

  const isIdle = status === 'idle' || status === 'ready';
  const isTerminated = status === 'terminated';
  const structures = snapshot?.heap_structures ?? [];

  // Filter out empty structures (null-pointer roots, empty arrays)
  const nonEmptyStructures = useMemo(
    () => structures.filter((s) => s.nodes.length > 0),
    [structures],
  );

  // ---- Compute stacked layouts: each structure gets a vertical yOffset ----
  const STRUCT_GAP = 60;
  const layoutCanvas = useMemo(
    () => ({ w: Math.max(viewport.w, 2000), h: Math.max(viewport.h, 1200) }),
    [viewport],
  );

  const structLayouts = useMemo(() => {
    let cumY = 0;
    const results: { bounds: ContentBounds; yOffset: number }[] = [];
    for (const struct of nonEmptyStructures) {
      const raw = getStructBounds(struct, layoutCanvas);
      const shifted: ContentBounds = {
        minX: raw.minX,
        maxX: raw.maxX,
        minY: raw.minY + cumY,
        maxY: raw.maxY + cumY,
      };
      results.push({ bounds: shifted, yOffset: cumY });
      cumY += (raw.maxY - raw.minY) + STRUCT_GAP;
    }
    return results;
  }, [nonEmptyStructures, layoutCanvas]);

  // ---- Merged total bounds for stage sizing ----
  const totalBounds = useMemo(() => {
    if (structLayouts.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    return mergeBounds(structLayouts.map((l) => l.bounds));
  }, [structLayouts]);

  // ---- Stage dimensions: accommodate scaled content or fill viewport ----
  const contentW = totalBounds.maxX - totalBounds.minX;
  const contentH = totalBounds.maxY - totalBounds.minY;
  const stageW = Math.max(viewport.w, Math.ceil(contentW * stageScale));
  const stageH = Math.max(viewport.h, Math.ceil(contentH * stageScale));

  // ---- Resize observer ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setViewport({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Play diff animations ----
  useEffect(() => {
    if (!diffActions || diffActions.length === 0) return;
    const newCount = diffActions.length - prevActionsLen.current;
    if (newCount <= 0) return;

    const newActions = diffActions.slice(prevActionsLen.current);
    prevActionsLen.current = diffActions.length;

    const layer = stageRef.current?.getLayers()?.[0];
    if (!layer) return;

    const createdAddrs = new Set<string>();
    const changedAddrs = new Map<string, Record<string, { old: string; new: string }>>();

    for (const action of newActions) {
      switch (action.action) {
        case 'node_created':
          createdAddrs.add(action.node_addr);
          break;
        case 'value_changed':
          changedAddrs.set(
            action.node_addr,
            (action.detail?.changed_fields as Record<string, { old: string; new: string }>) ?? {},
          );
          break;
      }
    }

    createdAddrs.forEach((addr) => {
      const nodeGroup = layer.findOne(`.node-${addr}`);
      if (nodeGroup) {
        nodeGroup.scaleX(0);
        nodeGroup.scaleY(0);
        nodeGroup.opacity(0);
        nodeGroup.to({
          scaleX: 1, scaleY: 1, opacity: 1,
          duration: 0.4,
          easing: Konva.Easings.EaseOut,
        });
      }
    });

    changedAddrs.forEach((_fields, addr) => {
      const labelText = layer.findOne(`.label-${addr}`);
      if (!labelText) return;
      labelText.to({
        scaleX: 0.6, scaleY: 0.6, opacity: 0,
        duration: 0.12,
        onFinish: () => {
          labelText.to({
            scaleX: 1.1, scaleY: 1.1, opacity: 1, fill: '#2e7d32',
            duration: 0.15,
            onFinish: () => {
              labelText.to({
                scaleX: 1, scaleY: 1, fill: '#333',
                duration: 0.13,
              });
            },
          });
        },
      });
    });

    // ---- Sort animation: element_compared — yellow flash on both rects ----
    const comparedAddrs = new Set<string>();
    for (const action of newActions) {
      if (action.action === 'element_compared') {
        const addrs = action.node_addr.split(',');
        addrs.forEach((a) => comparedAddrs.add(a));
      }
    }
    comparedAddrs.forEach((addr) => {
      const rect = layer.findOne(`.rect-${addr}`) as Konva.Rect | null;
      if (!rect) return;
      const origFill = rect.fill();
      rect.to({
        fill: '#ffa726',
        duration: 0.1,
        onFinish: () => {
          rect.to({ fill: origFill, duration: 0.2 });
        },
      });
    });

    // ---- Sort animation: element_swapped — orange flash + value transition ----
    const swappedInfo = new Map<string, { val_a: string; val_b: string }>();
    for (const action of newActions) {
      if (action.action === 'element_swapped') {
        const detail = action.detail as Record<string, string>;
        swappedInfo.set(detail.node_a, { val_a: detail.val_a, val_b: detail.val_b });
        swappedInfo.set(detail.node_b, { val_a: detail.val_a, val_b: detail.val_b });
      }
    }
    swappedInfo.forEach((info, addr) => {
      const rect = layer.findOne(`.rect-${addr}`) as Konva.Rect | null;
      const label = layer.findOne(`.label-${addr}`) as Konva.Text | null;
      if (!rect || !label) return;
      const origFill = rect.fill();

      // Phase 1: orange flash
      rect.to({
        fill: '#ef6c00',
        duration: 0.08,
        onFinish: () => {
          // Phase 2: gray out old value
          label.to({
            fill: '#bbb', opacity: 0.5,
            duration: 0.05,
            onFinish: () => {
              // Phase 3: update text + green flash
              const isNodeA = (action: { detail?: Record<string, unknown> }) =>
                (action.detail as Record<string, string>)?.node_a === addr;
              // Find which value to show
              const swapAction = newActions.find(
                (a) => a.action === 'element_swapped' &&
                  a.node_addr.includes(addr)
              );
              if (swapAction) {
                const d = swapAction.detail as Record<string, string>;
                label.text(addr === d.node_a ? d.val_a : d.val_b);
              }
              label.to({
                fill: '#2e7d32', opacity: 1,
                duration: 0.1,
                onFinish: () => {
                  label.to({ fill: '#333', duration: 0.1 });
                  rect.to({ fill: origFill, duration: 0.15 });
                },
              });
            },
          });
        },
      });
    });
  }, [diffActions]);

  // ---- Reset animation tracker on step change ----
  // Note: we do NOT reset scale/scroll here — the user's view stays stable
  useEffect(() => {
    prevActionsLen.current = 0;
  }, [snapshot?.step_number]);

  // ---- Reset zoom on new session (step 1) ----
  useEffect(() => {
    if (snapshot?.step_number === 1) {
      setStageScale(1);
      if (containerRef.current) {
        containerRef.current.scrollTo({ left: 0, top: 0, behavior: 'instant' as ScrollBehavior });
      }
    }
  }, [snapshot?.step_number]);

  // ---- Mouse drag-to-pan handlers ----
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    // Only handle left button; ignore when clicking scrollbars
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.konvajs-content')) {
      dragState.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        scrollStartX: containerRef.current?.scrollLeft ?? 0,
        scrollStartY: containerRef.current?.scrollTop ?? 0,
      };
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    containerRef.current?.scrollTo({
      left: dragState.current.scrollStartX - dx,
      top: dragState.current.scrollStartY - dy,
      behavior: 'instant' as ScrollBehavior,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.active = false;
    setIsDragging(false);
  }, []);

  // ---- Empty / terminal states ----
  if (isIdle || (nonEmptyStructures.length === 0 && !isTerminated)) {
    return (
      <div
        ref={containerRef}
        style={{
          height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#f9f9fb',
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#fff', border: '2px dashed #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 24, opacity: 0.4 }}>📐</span>
        </div>
        <div style={{ fontSize: 13, color: '#bbb', marginBottom: 4 }}>
          可视化画布 — 代码中添加 @viz 标注以启用
        </div>
        <div style={{ fontSize: 11, color: '#ddd', fontFamily: 'monospace' }}>
          // @viz linked_list(名称) head=头指针.next_field=next
        </div>
      </div>
    );
  }

  if (isTerminated && nonEmptyStructures.length === 0) {
    return (
      <div ref={containerRef} style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9fb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="1.5">
              <path d="M12 2v8M12 18v4M4.93 4.93l5.66 5.66M13.41 13.41l5.66 5.66M2 12h8M14 12h8M4.93 19.07l5.66-5.66M13.41 10.59l5.66-5.66" strokeWidth="1.5" />
            </svg>
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>程序已结束</div>
        </div>
      </div>
    );
  }

  const stageSize = { w: stageW, h: stageH };

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'auto', background: '#f9f9fb', cursor: isDragging ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Stage
        ref={stageRef}
        width={stageW} height={stageH}
        scaleX={stageScale} scaleY={stageScale}
      >
        <Layer>
          {nonEmptyStructures.map((struct, idx) => {
            const yOff = structLayouts[idx]?.yOffset ?? 0;
            let content;
            if (struct.structure_type === 'binary_tree') content = renderBinaryTree(struct, stageSize);
            else if (struct.structure_type === 'array') content = renderArray(struct, stageSize);
            else if (struct.structure_type === 'stack') content = renderStack(struct, stageSize);
            else if (struct.structure_type === 'queue') content = renderQueue(struct, stageSize);
            else if (struct.structure_type === 'heap') content = renderHeap(struct, stageSize);
            else if (struct.structure_type === 'graph') content = renderGraph(struct, stageSize);
            else if (struct.structure_type === 'hashmap') content = renderHashmap(struct, stageSize);
            else content = renderLinkedList(struct, stageSize);
            return (
              <Group key={`struct-wrap-${struct.annotation_name}-${idx}`} y={yOff}>
                {content}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linked list rendering
// ---------------------------------------------------------------------------

function renderLinkedList(
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
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = positions[nodes[i].addr];
    const to = positions[nodes[i + 1].addr];
    elements.push(
      <Arrow
        key={`arrow-${i}`}
        points={[from.cx + NODE_W / 2 + 4, from.cy, to.cx - NODE_W / 2 - 4, to.cy]}
        pointerLength={8} pointerWidth={8}
        fill="#888" stroke="#888" strokeWidth={2}
      />
    );
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

  // Node rectangles + labels
  nodes.forEach((node) => {
    const { x, y } = positions[node.addr];
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group
        key={`node-${node.addr}`}
        name={`node-${node.addr}`}
      >
        <Rect
          x={x} y={y}
          width={NODE_W} height={NODE_H}
          cornerRadius={NODE_RADIUS}
          fill={hasPointers ? '#e3f2fd' : '#fff'}
          stroke={hasPointers ? '#1a73e8' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(26,115,232,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y + 6}
          width={NODE_W} height={20}
          align="center" verticalAlign="middle"
          fontSize={12} fontStyle="bold" fill="#333"
        />
        <Text
          text={shortAddr(node.addr)}
          x={x} y={y + 24}
          width={NODE_W} height={16}
          align="center" verticalAlign="middle"
          fontSize={9} fill="#bbb"
        />
      </Group>
    );
  });

  // Pointer labels (below nodes)
  nodes.forEach((node) => {
    const ptrs = node.pointers_pointing_here;
    if (ptrs.length === 0) return;
    const { cx } = positions[node.addr];

    ptrs.forEach((ptr, pi) => {
      const labelY = CENTER_Y + NODE_H / 2 + 14 + pi * 20;

      elements.push(
        <Line
          key={`ptr-line-${node.addr}-${ptr}`}
          points={[cx, CENTER_Y + NODE_H / 2, cx, labelY - 4]}
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

  // Structure name label
  elements.push(
    <Text
      key="struct-name"
      text={struct.annotation_name}
      x={startX} y={CENTER_Y - NODE_H / 2 - 32}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---------------------------------------------------------------------------
// Array rendering
// ---------------------------------------------------------------------------

function renderArray(
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
          fill={hasPointers ? '#e8f5e9' : '#fff'}
          stroke={hasPointers ? '#2e7d32' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(46,125,50,0.15)' : 'transparent'}
          shadowBlur={6}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x} y={y + 4}
          width={ARRAY_CELL_W} height={20}
          align="center" verticalAlign="middle"
          fontSize={13} fontStyle="bold" fill="#333"
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
    const { cx } = positions[node.addr];

    ptrs.forEach((ptr, pi) => {
      const labelY = ARRAY_START_Y + ARRAY_CELL_H + 22 + pi * 20;

      elements.push(
        <Line
          key={`ptr-line-${node.addr}-${ptr}`}
          points={[cx, ARRAY_START_Y + ARRAY_CELL_H + 18, cx, labelY - 4]}
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

  // Structure name label
  elements.push(
    <Text
      key="struct-name"
      text={struct.annotation_name}
      x={startX} y={ARRAY_START_Y - 28}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

function shortAddr(addr: string): string {
  if (!addr || addr === '0x0') return 'nullptr';
  return '…' + addr.slice(-4);
}

// ---- Stack rendering (sequential + linked) ----

function renderStack(
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

function renderSequentialStack(
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
          fill={hasPointers ? '#e3f2fd' : '#fff'}
          stroke={hasPointers ? '#1a73e8' : '#b0b0b0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(26,115,232,0.12)' : 'transparent'}
          shadowBlur={4}
        />
        <Text
          name={`label-${node.addr}`}
          text={node.label}
          x={x + 8} y={y + 4}
          width={STACK_CELL_W - 16} height={18}
          align="center" verticalAlign="middle"
          fontSize={12} fontStyle="bold" fill="#333"
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

  // Structure name
  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (stack)`
    } x={STACK_START_X} y={STACK_START_Y - 26}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

function renderLinkedStack(
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
        <Rect x={x} y={y} width={NODE_W} height={NODE_H} cornerRadius={NODE_RADIUS}
          fill={hasPointers ? '#e3f2fd' : '#fff'}
          stroke={hasPointers ? '#1a73e8' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(26,115,232,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x} y={y + 6} width={NODE_W} height={20}
          align="center" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#333"
        />
        <Text text={shortAddr(node.addr)}
          x={x} y={y + 24} width={NODE_W} height={16}
          align="center" verticalAlign="middle" fontSize={9} fill="#bbb"
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

  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (linked stack)`
    } x={startX} y={CENTER_Y - NODE_H / 2 - 40}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---- Queue rendering (circular + linked) ----

function renderQueue(
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

function renderCircularQueue(
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
          fill={hasPointers ? '#e8f5e9' : '#fff'}
          stroke={hasPointers ? '#2e7d32' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(46,125,50,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x} y={y + 4} width={QUEUE_CELL_W} height={20}
          align="center" verticalAlign="middle" fontSize={13} fontStyle="bold" fill="#333"
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

  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (queue)`
    } x={startX} y={CENTER_Y - QUEUE_CELL_H / 2 - 42}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

function renderLinkedQueue(
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
        <Rect x={x} y={y} width={NODE_W} height={NODE_H} cornerRadius={NODE_RADIUS}
          fill={hasPointers ? '#e3f2fd' : '#fff'}
          stroke={hasPointers ? '#1a73e8' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2 : 1}
          shadowColor={hasPointers ? 'rgba(26,115,232,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x} y={y + 6} width={NODE_W} height={20}
          align="center" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#333"
        />
        <Text text={shortAddr(node.addr)}
          x={x} y={y + 24} width={NODE_W} height={16}
          align="center" verticalAlign="middle" fontSize={9} fill="#bbb"
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

  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (linked queue)`
    } x={startX} y={CENTER_Y - NODE_H / 2 - 40}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---- Heap (binary heap, array-as-tree) rendering ----

function renderHeap(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  // Build a virtual binary tree from array indices (0-based)
  const { nodes } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
      </Group>
    );
  }

  // Compute depth for each node using heap property: child at 2i+1, 2i+2
  const depth: number[] = nodes.map((_, i) => {
    let d = 0;
    let idx = i;
    while (idx > 0) { idx = Math.floor((idx - 1) / 2); d++; }
    return d;
  });
  const maxDepth = Math.max(...depth);

  // Group by depth
  const nodesByDepth: number[][] = Array.from({ length: maxDepth + 1 }, () => []);
  depth.forEach((d, i) => nodesByDepth[d].push(i));

  // Position nodes
  const positions: { x: number; y: number }[] = [];
  const startY = 30;
  const usableWidth = canvasSize.w - 60;

  for (let level = 0; level <= maxDepth; level++) {
    const count = nodesByDepth[level].length;
    const gap = count > 1 ? Math.min(100, usableWidth / (count + 1)) : 0;
    const totalWidth = count > 1 ? (count - 1) * gap : 0;
    const startX = (canvasSize.w - totalWidth) / 2;

    nodesByDepth[level].forEach((nodeIdx, i) => {
      positions[nodeIdx] = {
        x: count === 1 ? canvasSize.w / 2 : startX + i * gap,
        y: startY + level * TREE_LEVEL_H,
      };
    });
  }

  const elements: React.ReactNode[] = [];

  // Edges from parent to children
  for (let i = 0; i < nodes.length; i++) {
    const left = 2 * i + 1;
    const right = 2 * i + 2;
    if (left < nodes.length && positions[i] && positions[left]) {
      elements.push(
        <Arrow key={`heap-edge-${i}-l`}
          points={[positions[i].x, positions[i].y + TREE_NODE_RADIUS,
                   positions[left].x, positions[left].y - TREE_NODE_RADIUS]}
          pointerLength={6} pointerWidth={6} fill="#888" stroke="#888" strokeWidth={1.5}
        />
      );
    }
    if (right < nodes.length && positions[i] && positions[right]) {
      elements.push(
        <Arrow key={`heap-edge-${i}-r`}
          points={[positions[i].x, positions[i].y + TREE_NODE_RADIUS,
                   positions[right].x, positions[right].y - TREE_NODE_RADIUS]}
          pointerLength={6} pointerWidth={6} fill="#888" stroke="#888" strokeWidth={1.5}
        />
      );
    }
  }

  // Nodes as circles
  nodes.forEach((node, i) => {
    const pos = positions[i];
    if (!pos) return;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`heap-node-${node.addr}`} name={`node-${node.addr}`}
        x={pos.x} y={pos.y}>
        <Circle radius={TREE_NODE_RADIUS}
          fill={hasPointers ? '#e8f5e9' : '#fff'}
          stroke={hasPointers ? '#2e7d32' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2.5 : 1.5}
          shadowColor={hasPointers ? 'rgba(46,125,50,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={-TREE_NODE_RADIUS} y={-6} width={TREE_NODE_RADIUS * 2} height={16}
          align="center" verticalAlign="middle" fontSize={13} fontStyle="bold" fill="#333"
        />
        <Text text={`[${i}]`}
          x={-TREE_NODE_RADIUS} y={10} width={TREE_NODE_RADIUS * 2} height={12}
          align="center" verticalAlign="middle" fontSize={8} fill="#bbb"
        />
      </Group>
    );
  });

  // Structure name
  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (heap)`
    } x={canvasSize.w / 2 - 30} y={6} width={60}
      fontSize={11} fill="#999" fontStyle="bold" align="center"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---- Graph rendering ----

function renderGraph(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
      </Group>
    );
  }

  // Circular layout for graph vertices
  const cx = GRAPH_CENTER_X;
  const cy = GRAPH_CENTER_Y;
  const radius = GRAPH_RADIUS;
  const vertexCount = nodes.length;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (2 * Math.PI * i) / vertexCount - Math.PI / 2;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  const elements: React.ReactNode[] = [];

  // Edges with arrows
  edges.forEach((edge, i) => {
    const from = positions[edge.from_idx];
    const to = positions[edge.to_idx];
    if (!from || !to) return;

    // Compute line with offset from circle boundary
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const startX = from.x + nx * GRAPH_NODE_RADIUS;
    const startY = from.y + ny * GRAPH_NODE_RADIUS;
    const endX = to.x - nx * GRAPH_NODE_RADIUS;
    const endY = to.y - ny * GRAPH_NODE_RADIUS;

    elements.push(
      <Arrow key={`graph-edge-${i}`}
        points={[startX, startY, endX, endY]}
        pointerLength={8} pointerWidth={8} fill="#888" stroke="#888" strokeWidth={1.5}
      />
    );
  });

  // Vertex circles
  nodes.forEach((node, i) => {
    const pos = positions[i];
    if (!pos) return;
    const hasPointers = node.pointers_pointing_here.length > 0;

    elements.push(
      <Group key={`graph-node-${node.addr}`} name={`node-${node.addr}`}
        x={pos.x} y={pos.y}>
        <Circle radius={GRAPH_NODE_RADIUS}
          fill={hasPointers ? '#e8f5e9' : '#fff'}
          stroke={hasPointers ? '#2e7d32' : '#c0c0c0'}
          strokeWidth={hasPointers ? 2.5 : 1.5}
          shadowColor={hasPointers ? 'rgba(46,125,50,0.15)' : 'transparent'} shadowBlur={6}
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={-GRAPH_NODE_RADIUS} y={-6} width={GRAPH_NODE_RADIUS * 2} height={16}
          align="center" verticalAlign="middle" fontSize={13} fontStyle="bold" fill="#333"
        />
      </Group>
    );
  });

  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (graph)`
    } x={cx - 30} y={cy - radius - 28} width={60}
      fontSize={11} fill="#999" fontStyle="bold" align="center"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---- Hashmap rendering ----

function renderHashmap(
  struct: HeapStructure,
  canvasSize: { w: number; h: number },
) {
  const { nodes, edges } = struct;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 40} y={canvasSize.h / 2 - 20}>
        <Rect width={80} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="EMPTY" x={0} y={0} width={80} height={40} align="center" verticalAlign="middle" fontSize={12} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={40} y={45} fontSize={11} fill="#bbb" align="center" />
      </Group>
    );
  }

  const elements: React.ReactNode[] = [];

  // Separate bucket nodes from chain nodes
  // Bucket nodes have an index field and are first in the array
  const bucketNodes = nodes.filter(n => {
    const fields = n.fields as Record<string, string>;
    return fields.bucket_idx !== undefined;
  });

  // If no bucket nodes (flat structure), treat all as buckets
  const allBuckets = bucketNodes.length > 0 ? bucketNodes : nodes;
  const chainNodes = bucketNodes.length > 0
    ? nodes.filter(n => (n.fields as Record<string, string>).bucket_idx === undefined)
    : [];

  const startX = Math.max(40, (canvasSize.w - allBuckets.length * (HMAP_BUCKET_W + 8)) / 2);
  const startY = 60;

  // Layout buckets horizontally
  const bucketPositions: Map<string, { x: number; y: number; cx: number; cy: number }> = new Map();
  allBuckets.forEach((node, i) => {
    const x = startX + i * (HMAP_BUCKET_W + 8);
    const y = startY;
    bucketPositions.set(node.addr, { x, y, cx: x + HMAP_BUCKET_W / 2, cy: y + HMAP_BUCKET_H / 2 });
    const fields = node.fields as Record<string, string>;
    const idx = fields.bucket_idx ?? fields.index ?? String(i);

    elements.push(
      <Group key={`hmap-bucket-${node.addr}`} name={`node-${node.addr}`}>
        <Rect name={`rect-${node.addr}`}
          x={x} y={y} width={HMAP_BUCKET_W} height={HMAP_BUCKET_H}
          cornerRadius={4} fill="#fff" stroke="#7986cb" strokeWidth={2}
        />
        <Text text={`[${idx}]`}
          x={x + 4} y={y + 2} width={36} height={16}
          fontSize={10} fill="#7986cb" fontStyle="bold"
        />
        <Text name={`label-${node.addr}`} text={node.label}
          x={x + 36} y={y + 2} width={HMAP_BUCKET_W - 44} height={16}
          align="right" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#333"
        />
        <Text text={shortAddr(node.addr)}
          x={x + 4} y={y + HMAP_BUCKET_H - 16} width={HMAP_BUCKET_W - 8} height={14}
          align="left" verticalAlign="middle" fontSize={9} fill="#bbb"
        />
      </Group>
    );
  });

  // Layout chain nodes below their parent buckets
  // Use edges to determine which chain nodes belong to which bucket
  const bucketChains: Map<string, { addr: string; x: number; y: number; cx: number; cy: number }[]> = new Map();

  // Process edges to build chains
  edges.forEach((edge) => {
    const fromIdx = edge.from_idx;
    const toIdx = edge.to_idx;
    if (fromIdx < nodes.length && toIdx < nodes.length) {
      const fromNode = nodes[fromIdx];
      const toNode = nodes[toIdx];
      const fromPos = bucketPositions.get(fromNode.addr);
      if (fromPos) {
        // from is a bucket — add chain node
        const chain = bucketChains.get(fromNode.addr) ?? [];
        const chainIdx = chain.length;
        const cy = fromPos.y + HMAP_BUCKET_H + 18 + chainIdx * (NODE_H + 6);
        chain.push({
          addr: toNode.addr,
          x: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP,
          y: cy - NODE_H / 2,
          cx: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP + NODE_W / 2,
          cy,
        });
        bucketChains.set(fromNode.addr, chain);

        // Arrow from bucket to first chain node, or chain-to-chain
        const prevAddr = chainIdx > 0 ? chain[chainIdx - 1].addr : fromNode.addr;
        const prevNode = chainIdx > 0
          ? { addr: prevAddr, x: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP,
              cx: fromPos.x + HMAP_BUCKET_W + HMAP_CHAIN_GAP + NODE_W / 2,
              y: fromPos.y + HMAP_BUCKET_H + 18 + (chainIdx - 1) * (NODE_H + 6) - NODE_H / 2,
              cy: fromPos.y + HMAP_BUCKET_H + 18 + (chainIdx - 1) * (NODE_H + 6) }
          : { addr: fromNode.addr, x: fromPos.x, cx: fromPos.cx, y: fromPos.y, cy: fromPos.cy };
      }
    }
  });

  // Render chain nodes with arrows
  bucketChains.forEach((chain, bucketAddr) => {
    const bucketPos = bucketPositions.get(bucketAddr);
    if (!bucketPos) return;

    chain.forEach((chainNode, ci) => {
      elements.push(
        <Group key={`hmap-chain-${chainNode.addr}`} name={`node-${chainNode.addr}`}>
          <Rect x={chainNode.x} y={chainNode.y} width={NODE_W} height={NODE_H}
            cornerRadius={6} fill="#fff" stroke="#c0c0c0" strokeWidth={1}
          />
          <Text name={`label-${chainNode.addr}`}
            text={nodes.find(n => n.addr === chainNode.addr)?.label ?? ''}
            x={chainNode.x} y={chainNode.y + 6} width={NODE_W} height={20}
            align="center" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#333"
          />
          <Text text={shortAddr(chainNode.addr)}
            x={chainNode.x} y={chainNode.y + 24} width={NODE_W} height={16}
            align="center" verticalAlign="middle" fontSize={9} fill="#bbb"
          />
        </Group>
      );

      // Arrow
      const fromPos = ci === 0 ? bucketPos : chain[ci - 1];
      if (fromPos) {
        elements.push(
          <Arrow key={`hmap-arrow-${bucketAddr}-${ci}`}
            points={[fromPos.cx + (ci === 0 ? HMAP_BUCKET_W / 2 : NODE_W / 2) + 4,
                     fromPos.cy,
                     chainNode.cx - NODE_W / 2 - 4,
                     chainNode.cy]}
            pointerLength={8} pointerWidth={8} fill="#888" stroke="#888" strokeWidth={1.5}
          />
        );
      }
    });
  });

  elements.push(
    <Text key="struct-name" text={`${struct.annotation_name} (hashmap)`
    } x={startX} y={startY - 28}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

// ---------------------------------------------------------------------------
// Binary tree rendering
// ---------------------------------------------------------------------------

function renderBinaryTree(
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
          radius={TREE_NODE_RADIUS}
          fill={hasPointers ? '#e8f5e9' : '#fff'}
          stroke={hasPointers ? '#2e7d32' : '#c0c0c0'}
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
        <Text
          text={shortAddr(node.addr)}
          x={-TREE_NODE_RADIUS} y={10}
          width={TREE_NODE_RADIUS * 2} height={14}
          align="center" verticalAlign="middle"
          fontSize={8} fill="#bbb"
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

  // Structure name label
  elements.push(
    <Text
      key="struct-name"
      text={struct.annotation_name}
      x={canvasSize.w / 2 - 30} y={6}
      width={60}
      fontSize={11} fill="#999" fontStyle="bold" align="center"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

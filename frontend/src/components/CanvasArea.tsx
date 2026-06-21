import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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

export default function CanvasArea() {
  const snapshot = useStore((s) => s.snapshot);
  const diffActions = useStore((s) => s.diffActions);
  const status = useStore((s) => s.status);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [viewport, setViewport] = useState({ w: 600, h: 320 });

  // Zoom state
  const [stageScale, setStageScale] = useState(1);
  // Pending scroll position after zoom (applied after re-render)
  const pendingScroll = useRef<{ x: number; y: number } | null>(null);

  // Track previously seen actions
  const prevActionsLen = useRef(0);

  const isIdle = status === 'idle' || status === 'ready';
  const isTerminated = status === 'terminated';
  const structures = snapshot?.heap_structures ?? [];

  // ---- Compute content bounds from all structures ----
  const totalBounds = useMemo(() => {
    const all: ContentBounds[] = [];
    // Use a large canvas size for layout calculation so centering logic
    // doesn't artificially constrain long lists
    const layoutCanvas = { w: Math.max(viewport.w, 2000), h: Math.max(viewport.h, 1200) };
    for (const struct of structures) {
      if (struct.structure_type === 'binary_tree') {
        const layout = getBinaryTreeLayout(struct, layoutCanvas);
        if (layout) all.push(layout.bounds);
      } else if (struct.structure_type === 'array') {
        const layout = getArrayLayout(struct, layoutCanvas);
        if (layout) all.push(layout.bounds);
      } else {
        const layout = getLinkedListLayout(struct, layoutCanvas);
        if (layout) all.push(layout.bounds);
      }
    }
    return mergeBounds(all);
  }, [structures, viewport]);

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

  // ---- Apply pending scroll after stage dimensions change (zoom) ----
  useEffect(() => {
    if (pendingScroll.current && containerRef.current) {
      const el = containerRef.current;
      el.scrollTo({ left: pendingScroll.current.x, top: pendingScroll.current.y, behavior: 'instant' as ScrollBehavior });
      pendingScroll.current = null;
    }
  }, [stageW, stageH]);

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

  // ---- Wheel handler: Ctrl/Meta+scroll → zoom; normal scroll → browser scroll ----
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const scrollX = container.scrollLeft;
      const scrollY = container.scrollTop;

      // Content point under cursor (in unscaled coordinate space)
      const contentX = (cursorX + scrollX) / stageScale;
      const contentY = (cursorY + scrollY) / stageScale;

      const scaleBy = 1.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0
        ? Math.min(3, stageScale * scaleBy)
        : Math.max(0.25, stageScale / scaleBy);

      // New scroll position to keep contentX,contentY under cursor
      const newScrollX = contentX * newScale - cursorX;
      const newScrollY = contentY * newScale - cursorY;

      pendingScroll.current = { x: newScrollX, y: newScrollY };
      setStageScale(newScale);
    }
    // Normal scroll: do nothing, let browser handle it
  }, [stageScale]);

  // ---- Empty / terminal states ----
  if (isIdle || (structures.length === 0 && !isTerminated)) {
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

  if (isTerminated && structures.length === 0) {
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
      style={{ height: '100%', overflow: 'auto', background: '#f9f9fb' }}
      onWheel={handleWheel}
    >
      <Stage
        ref={stageRef}
        width={stageW} height={stageH}
        scaleX={stageScale} scaleY={stageScale}
      >
        <Layer>
          {structures.map((struct) => {
            if (struct.structure_type === 'binary_tree') return renderBinaryTree(struct, stageSize);
            if (struct.structure_type === 'array') return renderArray(struct, stageSize);
            return renderLinkedList(struct, stageSize);
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

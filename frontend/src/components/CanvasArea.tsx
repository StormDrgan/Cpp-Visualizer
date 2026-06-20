import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Arrow, Group, Line } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../store/useStore';
import type { HeapStructure, HeapNode, DiffAction } from '../types';

// Layout constants
const NODE_W = 88;
const NODE_H = 44;
const NODE_GAP = 70;
const NODE_RADIUS = 6;
const START_X = 60;
const CENTER_Y = 160;

export default function CanvasArea() {
  const snapshot = useStore((s) => s.snapshot);
  const diffActions = useStore((s) => s.diffActions);
  const status = useStore((s) => s.status);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });

  // Track previously seen actions to avoid re-animating
  const prevActionsLen = useRef(0);

  const isIdle = status === 'idle' || status === 'ready';
  const isTerminated = status === 'terminated';
  const structures = snapshot?.heap_structures ?? [];

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Play diff animations when new actions arrive
  useEffect(() => {
    if (!diffActions || diffActions.length === 0) return;
    // Only process new actions
    const newCount = diffActions.length - prevActionsLen.current;
    if (newCount <= 0) return;

    const newActions = diffActions.slice(prevActionsLen.current);
    prevActionsLen.current = diffActions.length;

    const layer = stageRef.current?.getLayers()?.[0];
    if (!layer) return;

    // Group actions by type for efficient batch processing
    const createdAddrs = new Set<string>();
    const removedAddrs = new Set<string>();
    const changedAddrs = new Map<string, Record<string, { old: string; new: string }>>();

    for (const action of newActions) {
      switch (action.action) {
        case 'node_created':
          createdAddrs.add(action.node_addr);
          break;
        case 'node_removed':
          removedAddrs.add(action.node_addr);
          break;
        case 'value_changed':
          changedAddrs.set(action.node_addr,
            (action.detail?.changed_fields as Record<string, { old: string; new: string }>) ?? {});
          break;
      }
    }

    // Animate created nodes: find them by name and pop in
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

    // Animate value changes: flash effect on label text
    changedAddrs.forEach((fields, addr) => {
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
  }, [diffActions]);

  // Reset prevActionsLen when structures change (new debug session)
  useEffect(() => {
    prevActionsLen.current = 0;
  }, [snapshot?.step_number]);

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

  return (
    <div ref={containerRef} style={{ height: '100%', background: '#f9f9fb' }}>
      <Stage ref={stageRef} width={size.w} height={size.h}>
        <Layer>
          {structures.map((struct) =>
            renderLinkedList(struct, size)
          )}
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
  const nodes = struct.nodes;
  if (nodes.length === 0) {
    return (
      <Group key={`${struct.annotation_name}-empty`} x={canvasSize.w / 2 - 30} y={canvasSize.h / 2 - 20}>
        <Rect width={60} height={40} cornerRadius={4} fill="#f5f5f5" stroke="#ccc" strokeWidth={1} />
        <Text text="NULL" x={0} y={0} width={60} height={40} align="center" verticalAlign="middle" fontSize={13} fill="#999" fontStyle="bold" />
        <Text text={struct.annotation_name} x={30} y={45} fontSize={11} fill="#bbb" align="center" />
      </Group>
    );
  }

  const elements: React.ReactNode[] = [];
  const totalWidth = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
  const startX = Math.max(START_X, (canvasSize.w - totalWidth) / 2);

  // Build address → position map
  const positions: Record<string, { x: number; y: number; cx: number; cy: number }> = {};

  nodes.forEach((node, i) => {
    const x = startX + i * (NODE_W + NODE_GAP);
    const y = CENTER_Y - NODE_H / 2;
    positions[node.addr] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
  });

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
      x={START_X} y={CENTER_Y - NODE_H / 2 - 32}
      fontSize={11} fill="#999" fontStyle="bold"
    />
  );

  return <Group key={struct.annotation_name}>{elements}</Group>;
}

function shortAddr(addr: string): string {
  if (!addr || addr === '0x0') return 'nullptr';
  return '…' + addr.slice(-4);
}

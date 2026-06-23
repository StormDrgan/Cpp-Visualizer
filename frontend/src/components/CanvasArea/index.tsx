import { useRef, useEffect, useState, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../../store/useStore';
import type { ContentBounds } from './types';
import { mergeBounds } from './utils';
import { getStructBounds } from './layouts/bounds';
import { renderLinkedList } from './renderers/linkedList';
import { renderArray } from './renderers/array';
import { renderStack } from './renderers/stack';
import { renderQueue } from './renderers/queue';
import { renderHeap } from './renderers/heap';
import { renderGraph } from './renderers/graph';
import { renderHashmap } from './renderers/hashmap';
import { renderBinaryTree } from './renderers/binaryTree';
import { renderRecursionTree } from './renderers/recursionTree';
import { renderBTree, renderBPlusTree } from './renderers/bTree';

export default function CanvasArea() {
  const snapshot = useStore((s) => s.snapshot);
  const diffActions = useStore((s) => s.diffActions);
  const status = useStore((s) => s.status);
  const selectedVars = useStore((s) => s.selectedVars);
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

  // §v0.8: filter by user-selected visualization targets.
  // Two-level filtering:
  //  1. Structure-level: show if ANY associated variable is selected
  //     (primary annotation_name OR merged-in pointers_pointing_here).
  //  2. Node-level: strip deselected vars from pointers_pointing_here
  //     so pointer labels for unchecked variables disappear instantly.
  // If selectedVars is empty (no candidates loaded yet), show all as-is.
  const visibleStructures = useMemo(
    () => {
      if (selectedVars.size === 0) return nonEmptyStructures;
      return nonEmptyStructures
        .filter((s) => {
          const varName = s.annotation_name.replace(/^auto_/, '');
          if (selectedVars.has(varName)) return true;
          for (const n of s.nodes) {
            for (const ptr of (n.pointers_pointing_here ?? [])) {
              if (selectedVars.has(ptr)) return true;
            }
          }
          return false;
        })
        .map((s) => ({
          ...s,
          nodes: s.nodes.map((n) => ({
            ...n,
            pointers_pointing_here: (n.pointers_pointing_here ?? []).filter(
              (ptr) => selectedVars.has(ptr),
            ),
          })),
        }));
    },
    [nonEmptyStructures, selectedVars],
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
    for (const struct of visibleStructures) {
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
  }, [visibleStructures, layoutCanvas]);

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

    // ---- Stack/Queue animation: node_pushed — slide in ----
    for (const action of newActions) {
      if (action.action !== 'node_pushed') continue;
      const addr = action.node_addr;
      const nodeGroup = layer.findOne(`.node-${addr}`);
      if (!nodeGroup) continue;
      const detail = action.detail as Record<string, string>;
      const dir = detail.direction ?? 'top';
      // Save original position
      const origX = nodeGroup.x();
      const origY = nodeGroup.y();
      // Start from off-screen position
      if (dir === 'top') {
        nodeGroup.y(origY - 80);
      } else {
        nodeGroup.x(origX + 80);
      }
      nodeGroup.scaleX(0.6);
      nodeGroup.scaleY(0.6);
      nodeGroup.opacity(0);
      nodeGroup.to({
        x: origX,
        y: origY,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        duration: 0.3,
        easing: Konva.Easings.EaseOut,
      });
    }

    // ---- Stack/Queue animation: node_popped — shrink + fade out ----
    for (const action of newActions) {
      if (action.action !== 'node_popped') continue;
      const addr = action.node_addr;
      const nodeGroup = layer.findOne(`.node-${addr}`);
      if (!nodeGroup) continue;
      nodeGroup.to({
        scaleX: 0,
        scaleY: 0,
        opacity: 0,
        duration: 0.3,
        easing: Konva.Easings.EaseIn,
        onFinish: () => {
          nodeGroup.visible(false);
        },
      });
    }

    // ---- Heap animation: node_path_swapped — sequential flash along path ----
    for (const action of newActions) {
      if (action.action !== 'node_path_swapped') continue;
      const detail = action.detail as Record<string, unknown>;
      const pathIndices = detail.path_indices as number[];
      if (!pathIndices || pathIndices.length < 2) continue;

      // Flash each node in the path sequentially
      pathIndices.forEach((heapIdx, seqPos) => {
        const delay = seqPos * 150; // 150ms per step along path
        setTimeout(() => {
          const allRects = layer.find('.rect') as Konva.Shape[];
          // Find rects whose node's fields.index matches heapIdx
          for (const rect of allRects) {
            const group = rect.getParent();
            if (!group) continue;
            const label = group.findOne('.label') as Konva.Text | null;
            if (!label) continue;
            // Check if this node corresponds to the heap index
            // Look at the index label text `[i]`
            const indexText = group.findOne('.index-label');
            if (indexText) continue; // not needed, we use rect addr pattern
            // Instead, find matching label text
          }
          // Simpler approach: flash nodes at position pathIndices[seqPos]
          // by finding all rect- elements and picking by index
          const structRects = layer.find('.rect') as Konva.Shape[];
          // Sort by x position to approximate heap array order
          const sorted = [...structRects].sort((a, b) => a.x() - b.x());
          const targetRect = sorted[heapIdx];
          if (!targetRect) return;
          const origFill = targetRect.fill();
          targetRect.to({
            fill: '#ef6c00',
            duration: 0.1,
            onFinish: () => {
              targetRect.to({ fill: origFill, duration: 0.2 });
            },
          });
        }, delay);
      });
    }
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

  // ---- Wheel handler: Ctrl+Wheel = zoom (like Word), plain Wheel = scroll ----
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Don't zoom while user is dragging to pan
    if (dragState.current.active) return;

    // Only zoom when Ctrl (Windows/Linux) or ⌘ (Mac) is held — like Word
    if (!e.ctrlKey && !e.metaKey) return; // let browser scroll naturally

    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const zoomIn = e.deltaY < 0;
    // Tiny factor per wheel tick — trackpads fire many events per flick
    const factor = zoomIn ? 1.03 : 0.97;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    setStageScale((prev) => {
      const next = prev * factor;
      return Math.min(5, Math.max(0.2, next));
    });

    // Cursor-position zoom: keep the content point under the cursor stationary
    requestAnimationFrame(() => {
      const rect = container.getBoundingClientRect();
      const ox = mouseX - rect.left;
      const oy = mouseY - rect.top;
      container.scrollLeft = (container.scrollLeft + ox) * factor - ox;
      container.scrollTop = (container.scrollTop + oy) * factor - oy;
    });
  }, []);

  // ---- Empty / terminal states ----
  if (isIdle || (visibleStructures.length === 0 && !isTerminated)) {
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
          可视化画布 — 编译运行代码后自动显示
        </div>
        <div style={{ fontSize: 11, color: '#ddd', fontFamily: 'monospace' }}>
          指针变量会被自动检测并可视化
        </div>
      </div>
    );
  }

  if (isTerminated && visibleStructures.length === 0) {
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
      onWheel={handleWheel}
    >
      <Stage
        ref={stageRef}
        width={stageW} height={stageH}
        scaleX={stageScale} scaleY={stageScale}
      >
        <Layer>
          {visibleStructures.map((struct, idx) => {
            const yOff = structLayouts[idx]?.yOffset ?? 0;
            let content;
            if (struct.structure_type === 'binary_tree') content = renderBinaryTree(struct, stageSize);
            else if (struct.structure_type === 'array') content = renderArray(struct, stageSize);
            else if (struct.structure_type === 'stack') content = renderStack(struct, stageSize);
            else if (struct.structure_type === 'queue') content = renderQueue(struct, stageSize);
            else if (struct.structure_type === 'heap') content = renderHeap(struct, stageSize);
            else if (struct.structure_type === 'graph') content = renderGraph(struct, stageSize);
            else if (struct.structure_type === 'hashmap') content = renderHashmap(struct, stageSize);
            else if (struct.structure_type === 'recursion_tree') content = renderRecursionTree(struct, stageSize);
            else if (struct.structure_type === 'b_tree') content = renderBTree(struct, stageSize);
            else if (struct.structure_type === 'bplustree') content = renderBPlusTree(struct, stageSize);
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

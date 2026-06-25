import { describe, it, expect } from 'vitest';
import { getStructBounds } from '../../../../components/CanvasArea/layouts/bounds';
import type { HeapStructure } from '../../../../types';

const CANVAS = { w: 800, h: 600 };

function makeNode(addr: string, label: string, fields: Record<string, unknown> = {}, pointers: string[] = []): HeapStructure['nodes'][number] {
  return { addr, label, fields, pointers_pointing_here: pointers };
}

function makeStruct(type: string, nodes: HeapStructure['nodes']): HeapStructure {
  return {
    annotation_name: 's',
    structure_type: type,
    root_node_addr: nodes[0]?.addr ?? '',
    nodes,
    edges: [],
    cycle_detected: false,
  };
}

describe('getStructBounds', () => {
  it('returns emptyBounds for empty nodes', () => {
    const result = getStructBounds(makeStruct('array', []), CANVAS);
    expect(result.minY).toBe(0);
    expect(result.maxX).toBeGreaterThan(0);
  });

  it('dispatches to getBinaryTreeLayout for binary_tree type', () => {
    const s = makeStruct('binary_tree', [makeNode('0x1', 'Node')]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
    expect(result.maxY).toBeGreaterThan(result.minY);
  });

  it('dispatches to getBinaryTreeLayout for heap type', () => {
    const s = makeStruct('heap', [makeNode('0x1', 'Node', { index: '0', val: '5' })]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('dispatches to getArrayLayout for array type', () => {
    const s = makeStruct('array', [makeNode('0x1', 'arr[0]', { val: '1' })]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('dispatches to getStackLayout for stack type', () => {
    const s = makeStruct('stack', [makeNode('0x1', 'data[0]')]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('dispatches to getQueueLayout for queue without next field', () => {
    // nodes have no "next" field → queue layout
    const s = makeStruct('queue', [makeNode('0x1', 'q[0]')]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('dispatches to getLinkedListLayout for queue with next field', () => {
    const s = makeStruct('queue', [makeNode('0x1', 'Node', { next: '0x2' })]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('computes inline bounds for graph type', () => {
    const nodes = Array.from({ length: 3 }, (_, i) => makeNode(`0x${i}`, `V${i}`));
    const result = getStructBounds(makeStruct('graph', nodes), CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
    expect(result.maxY).toBeGreaterThan(result.minY);
  });

  it('computes inline bounds for hashmap type', () => {
    const nodes = Array.from({ length: 2 }, (_, i) => makeNode(`0x${i}`, `bucket${i}`));
    const result = getStructBounds(makeStruct('hashmap', nodes), CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('computes inline bounds for recursion_tree type', () => {
    const nodes = Array.from({ length: 3 }, (_, i) => makeNode(`fib:${i}`, `fib(${i})`, { depth: String(i), status: 'active' }));
    const result = getStructBounds(makeStruct('recursion_tree', nodes), CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
    expect(result.maxY).toBeGreaterThan(result.minY);
  });

  it('dispatches to getBTreeLayout for b_tree type', () => {
    const s = makeStruct('b_tree', [makeNode('0x1', 'BTreeNode')]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('dispatches to getBTreeLayout for bplustree type', () => {
    const s = makeStruct('bplustree', [makeNode('0x1', 'BPNode')]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });

  it('defaults to getLinkedListLayout for unknown types', () => {
    const s = makeStruct('linked_list', [makeNode('0x1', 'Node', { val: '5' })]);
    const result = getStructBounds(s, CANVAS);
    expect(result.maxX).toBeGreaterThan(result.minX);
  });
});

// ---- Matches backend snapshot.py / DESIGN.md §3.4 ----

export interface Variable {
  name: string;
  type: string;
  value: string;
  display_value: string;
  is_pointer: boolean;
  deref_type: string | null;
}

export interface StackFrame {
  function: string;
  line: number;
  file: string;
}

export interface HeapNode {
  addr: string;
  label: string;
  fields: Record<string, unknown>;
  pointers_pointing_here: string[];
}

export interface TreeEdge {
  from_idx: number;
  to_idx: number;
  child_side: string;
}

export interface HeapStructure {
  annotation_name: string;
  structure_type: string;
  root_node_addr: string;
  nodes: HeapNode[];
  edges: TreeEdge[];
  cycle_detected: boolean;
  prev_field?: string;         // v0.9: doubly linked list
  tree_variant?: string;       // v0.9: "avl" | "threaded" | ""
  traversal_state?: Record<string, string>;  // v0.9: addr -> color for graph traversal
}

export interface StateSnapshot {
  step_number: number;
  source_line: number;
  file: string;
  current_function: string;
  call_stack: StackFrame[];
  locals: Variable[];
  watched_expressions: { expression: string; value: string }[];
  heap_structures: HeapStructure[];
  candidates: CandidateVar[];
  stdout: string;
  is_terminated: boolean;
  exit_code: number | null;
  operation_summary?: string;   // v0.9: human-readable operation description
  recursion_tree?: RecursionTree; // v0.9: recursion tree visualization
}

/** A variable that can be toggled for visualization (§v0.8). */
export interface CandidateVar {
  var_name: string;
  struct_type: string;
  node_count: number;
  root_addr: string;
}

export interface CompileError {
  line: number | null;
  column?: number;
  severity?: string;
  message: string;
}

// ---- Differential animation actions ----

export interface DiffAction {
  action: 'node_created' | 'node_removed' | 'value_changed' | 'pointer_relocated'
         | 'no_change' | 'element_compared' | 'element_swapped'
         | 'node_pushed' | 'node_popped' | 'node_colored'
         | 'node_path_swapped';  // v0.9
  structure_name: string;
  node_addr: string;
  detail: Record<string, unknown>;
}

/** v0.9: Recursion tree node for call-stack visualization. */
export interface RecursionTreeNode {
  id: string;
  function_name: string;
  line: number;
  file: string;
  depth: number;
  parent_id: string | null;
  status: 'active' | 'returned';
}

/** v0.9: Recursion tree structure in snapshot. */
export interface RecursionTree {
  nodes: RecursionTreeNode[];
  edges: TreeEdge[];
}

// ---- Frontend-only state ----

export type SessionStatus = 'idle' | 'ready' | 'stepping' | 'running' | 'rewinding' | 'paused' | 'terminated';

export interface ExecutionState {
  sessionId: string | null;
  status: SessionStatus;
  currentLine: number | null;
  snapshot: StateSnapshot | null;
  breakpoints: Set<number>;
  compileErrors: CompileError[];
  error: string | null;
}

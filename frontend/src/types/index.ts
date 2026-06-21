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
         | 'no_change' | 'element_compared' | 'element_swapped';
  structure_name: string;
  node_addr: string;
  detail: Record<string, unknown>;
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

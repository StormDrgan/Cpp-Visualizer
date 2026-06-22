/** Frontend-side @viz annotation parsing & generation.
 *
 * Mirrors backend/annotations.py logic so the annotation panel and gutter tools
 * can read/write annotations without a round-trip to the server.
 */

// ---- Types ----

export interface VizAnnotation {
  /** Which line this annotation is on (1-indexed) */
  line: number;
  /** The raw "// @viz ..." text */
  raw: string;
  /** Parsed fields */
  struct_type: string;
  name: string;
  root_var: string;
  next_field: string;
  prev_field: string;
  left_field: string;
  right_field: string;
  length_var: string;
  top_var: string;
  front_var: string;
  rear_var: string;
  mode: string;
  watched_vars: string[];
}

/** Structure type definitions for the form */
export interface StructTypeDef {
  type: string;
  label: string;
  icon: string;
  fields: {
    key: string;        // field name in Annotation
    label: string;      // display label
    placeholder: string;
  }[];
  /** Template function: (name, fields) => "// @viz ..." */
  format: (name: string, fields: Record<string, string>) => string;
}

// ---- Struct type definitions ----

export const STRUCT_TYPES: StructTypeDef[] = [
  {
    type: 'linked_list',
    label: '链表',
    icon: '🔗',
    fields: [
      { key: 'root_var', label: '头指针变量', placeholder: 'head' },
      { key: 'next_field', label: 'next 字段名', placeholder: 'next' },
    ],
    format: (name, f) =>
      `// @viz linked_list(${name}) head=${f.root_var}.next_field=${f.next_field}`,
  },
  {
    type: 'linked_list_doubly',
    label: '双向链表',
    icon: '🔗',
    fields: [
      { key: 'root_var', label: '头指针变量', placeholder: 'head' },
      { key: 'next_field', label: 'next 字段名', placeholder: 'next' },
      { key: 'prev_field', label: 'prev 字段名', placeholder: 'prev' },
    ],
    format: (name, f) =>
      `// @viz linked_list(${name}) head=${f.root_var}.next_field=${f.next_field}.prev_field=${f.prev_field}`,
  },
  {
    type: 'binary_tree',
    label: '二叉树',
    icon: '🌳',
    fields: [
      { key: 'root_var', label: '根指针变量', placeholder: 'root' },
      { key: 'left_field', label: 'left 字段名', placeholder: 'left' },
      { key: 'right_field', label: 'right 字段名', placeholder: 'right' },
    ],
    format: (name, f) =>
      `// @viz binary_tree(${name}) root=${f.root_var}.left_field=${f.left_field}.right_field=${f.right_field}`,
  },
  {
    type: 'array',
    label: '数组',
    icon: '📊',
    fields: [
      { key: 'root_var', label: '数组变量名', placeholder: 'arr' },
      { key: 'length_var', label: '长度变量', placeholder: 'n' },
    ],
    format: (name, f) =>
      `// @viz array(${name}) var=${f.root_var}.length_var=${f.length_var}`,
  },
  {
    type: 'stack_seq',
    label: '顺序栈',
    icon: '📚',
    fields: [
      { key: 'root_var', label: '数组变量名', placeholder: 'arr' },
      { key: 'top_var', label: '栈顶索引变量', placeholder: 'top' },
    ],
    format: (name, f) =>
      `// @viz stack(${name}) var=${f.root_var}.top_var=${f.top_var}`,
  },
  {
    type: 'stack_linked',
    label: '链栈',
    icon: '📚',
    fields: [
      { key: 'root_var', label: '栈顶指针', placeholder: 'top' },
      { key: 'next_field', label: 'next 字段名', placeholder: 'next' },
    ],
    format: (name, f) =>
      `// @viz stack(${name}) var=${f.root_var}.next_field=${f.next_field}`,
  },
  {
    type: 'queue_circular',
    label: '循环队列',
    icon: '🚶',
    fields: [
      { key: 'root_var', label: '数组变量名', placeholder: 'queue' },
      { key: 'front_var', label: '队首索引', placeholder: 'front' },
      { key: 'rear_var', label: '队尾索引', placeholder: 'rear' },
    ],
    format: (name, f) =>
      `// @viz queue(${name}) var=${f.root_var}.front_var=${f.front_var}.rear_var=${f.rear_var}`,
  },
  {
    type: 'queue_linked',
    label: '链式队列',
    icon: '🚶',
    fields: [
      { key: 'root_var', label: '队首指针', placeholder: 'front' },
      { key: 'next_field', label: 'next 字段名', placeholder: 'next' },
    ],
    format: (name, f) =>
      `// @viz queue(${name}) var=${f.root_var}.next_field=${f.next_field}`,
  },
  {
    type: 'heap',
    label: '堆',
    icon: '⛰️',
    fields: [
      { key: 'root_var', label: '数组变量名', placeholder: 'arr' },
      { key: 'length_var', label: '长度变量', placeholder: 'size' },
    ],
    format: (name, f) =>
      `// @viz heap(${name}) var=${f.root_var}.length_var=${f.length_var}`,
  },
  {
    type: 'graph_matrix',
    label: '图（邻接矩阵）',
    icon: '🕸️',
    fields: [
      { key: 'root_var', label: '矩阵变量名', placeholder: 'mat' },
      { key: 'name', label: '顶点数变量', placeholder: 'n' },
    ],
    format: (name, f) =>
      `// @viz graph(${name}) var=${f.root_var}.mode=matrix.size_var=${f.name}`,
  },
  {
    type: 'graph_adjlist',
    label: '图（邻接表）',
    icon: '🕸️',
    fields: [
      { key: 'root_var', label: '邻接表变量名', placeholder: 'adj' },
      { key: 'name', label: '顶点数变量', placeholder: 'n' },
    ],
    format: (name, f) =>
      `// @viz graph(${name}) var=${f.root_var}.size_var=${f.name}`,
  },
  {
    type: 'hashmap',
    label: '哈希表',
    icon: '#️⃣',
    fields: [
      { key: 'root_var', label: '表变量名', placeholder: 'table' },
      { key: 'mode', label: '模式 (chaining/open_addressing)', placeholder: 'chaining' },
    ],
    format: (name, f) =>
      `// @viz hashmap(${name}) var=${f.root_var}.mode=${f.mode}`,
  },
  {
    type: 'recursion_tree',
    label: '递归树',
    icon: '🌀',
    fields: [],
    format: (name, _f) =>
      `// @viz recursion_tree(${name})`,
  },
  {
    type: 'watch',
    label: '监视指针',
    icon: '👁️',
    fields: [
      { key: 'watched_vars', label: '监视变量 (逗号分隔)', placeholder: 'slow, fast' },
    ],
    format: (name, f) =>
      `// @viz watch(${f.watched_vars})`,
  },
];

// ---- Simple parser ----

/**
 * Parse all @viz annotations from source code.
 * Returns array of parsed annotations with their line numbers.
 */
export function parseVizAnnotations(code: string): VizAnnotation[] {
  const lines = code.split('\n');
  const results: VizAnnotation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed.startsWith('// @viz') && !trimmed.startsWith('//@viz')) continue;

    const raw = trimmed;
    const ann = parseSingleAnnotation(trimmed);
    if (ann) {
      results.push({ ...ann, line: i + 1, raw });
    }
  }

  return results;
}

function parseSingleAnnotation(text: string): Omit<VizAnnotation, 'line' | 'raw'> | null {
  // Normalize: remove leading "//", optional spaces
  const s = text.replace(/^\/\/\s*/, '').trim();

  // linked_list with prev_field
  let m = s.match(/@viz\s+linked_list\((\w+)\)\s+head=(\w+(?:->\w+)*)\.next_field=(\w+)\.prev_field=(\w+)/);
  if (m) {
    return {
      struct_type: 'linked_list', name: m[1], root_var: m[2],
      next_field: m[3], prev_field: m[4],
      left_field: '', right_field: '', length_var: '',
      top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // linked_list
  m = s.match(/@viz\s+linked_list\((\w+)\)\s+head=(\w+(?:->\w+)*)\.next_field=(\w+)/);
  if (m) {
    return {
      struct_type: 'linked_list', name: m[1], root_var: m[2],
      next_field: m[3], prev_field: '',
      left_field: '', right_field: '', length_var: '',
      top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // binary_tree
  m = s.match(/@viz\s+binary_tree\((\w+)\)\s+root=(\w+(?:->\w+)*)\.left_field=(\w+)\.right_field=(\w+)/);
  if (m) {
    return {
      struct_type: 'binary_tree', name: m[1], root_var: m[2],
      left_field: m[3], right_field: m[4],
      next_field: '', prev_field: '', length_var: '',
      top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // array
  m = s.match(/@viz\s+array\((\w+)\)\s+var=(\w+(?:->\w+)*)\.length_var=(\w+)/);
  if (m) {
    return {
      struct_type: 'array', name: m[1], root_var: m[2], length_var: m[3],
      next_field: '', prev_field: '', left_field: '', right_field: '',
      top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // stack sequential
  m = s.match(/@viz\s+stack\((\w+)\)\s+var=(\w+(?:->\w+)*)\.top_var=(\w+)/);
  if (m) {
    return {
      struct_type: 'stack', name: m[1], root_var: m[2], top_var: m[3],
      next_field: '', prev_field: '', left_field: '', right_field: '',
      length_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // stack linked
  m = s.match(/@viz\s+stack\((\w+)\)\s+var=(\w+(?:->\w+)*)\.next_field=(\w+)/);
  if (m) {
    return {
      struct_type: 'stack', name: m[1], root_var: m[2], next_field: m[3],
      prev_field: '', left_field: '', right_field: '',
      length_var: '', top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // queue circular
  m = s.match(/@viz\s+queue\((\w+)\)\s+var=(\w+(?:->\w+)*)\.front_var=(\w+)\.rear_var=(\w+)/);
  if (m) {
    return {
      struct_type: 'queue', name: m[1], root_var: m[2],
      front_var: m[3], rear_var: m[4],
      next_field: '', prev_field: '', left_field: '', right_field: '',
      length_var: '', top_var: '', mode: '', watched_vars: [],
    };
  }

  // queue linked
  m = s.match(/@viz\s+queue\((\w+)\)\s+var=(\w+(?:->\w+)*)\.next_field=(\w+)/);
  if (m) {
    return {
      struct_type: 'queue', name: m[1], root_var: m[2], next_field: m[3],
      prev_field: '', left_field: '', right_field: '',
      length_var: '', top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // heap
  m = s.match(/@viz\s+heap\((\w+)\)\s+var=(\w+(?:->\w+)*)(?:\.length_var=(\w+))?/);
  if (m) {
    return {
      struct_type: 'heap', name: m[1], root_var: m[2], length_var: m[3] || '',
      next_field: '', prev_field: '', left_field: '', right_field: '',
      top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // graph matrix
  m = s.match(/@viz\s+graph\((\w+)\)\s+var=(\w+(?:->\w+)*)\.mode=matrix(?:\.size_var=(\w+))?/);
  if (m) {
    return {
      struct_type: 'graph', name: m[1], root_var: m[2], mode: 'matrix',
      length_var: m[3] || '',
      next_field: '', prev_field: '', left_field: '', right_field: '',
      top_var: '', front_var: '', rear_var: '', watched_vars: [],
    };
  }

  // graph adjlist
  m = s.match(/@viz\s+graph\((\w+)\)\s+var=(\w+(?:->\w+)*)(?:\.size_var=(\w+))?/);
  if (m) {
    return {
      struct_type: 'graph', name: m[1], root_var: m[2], mode: 'adjlist',
      length_var: m[3] || '',
      next_field: '', prev_field: '', left_field: '', right_field: '',
      top_var: '', front_var: '', rear_var: '', watched_vars: [],
    };
  }

  // hashmap
  m = s.match(/@viz\s+hashmap\((\w+)\)\s+var=(\w+(?:->\w+)*)(?:\.mode=(\w+))?/);
  if (m) {
    return {
      struct_type: 'hashmap', name: m[1], root_var: m[2], mode: m[3] || 'chaining',
      next_field: '', prev_field: '', left_field: '', right_field: '',
      length_var: '', top_var: '', front_var: '', rear_var: '', watched_vars: [],
    };
  }

  // recursion_tree
  m = s.match(/@viz\s+recursion_tree\((\w+)\)/);
  if (m) {
    return {
      struct_type: 'recursion_tree', name: m[1], root_var: '',
      next_field: '', prev_field: '', left_field: '', right_field: '',
      length_var: '', top_var: '', front_var: '', rear_var: '', mode: '', watched_vars: [],
    };
  }

  // watch
  m = s.match(/@viz\s+watch\(([^)]+)\)/);
  if (m) {
    return {
      struct_type: 'watch', name: '',
      watched_vars: m[1].split(',').map((v) => v.trim()).filter(Boolean),
      root_var: '', next_field: '', prev_field: '',
      left_field: '', right_field: '', length_var: '',
      top_var: '', front_var: '', rear_var: '', mode: '',
    };
  }

  return null;
}

/**
 * Remove an @viz annotation at a specific line from the code.
 */
export function removeAnnotationLine(code: string, line: number): string {
  const lines = code.split('\n');
  lines.splice(line - 1, 1);
  return lines.join('\n');
}

/**
 * Insert an @viz annotation line above the given line number.
 */
export function insertAnnotationAbove(
  code: string,
  line: number,
  annotationText: string,
): string {
  const lines = code.split('\n');
  // Insert before the target line (line is 1-indexed)
  const insertIdx = line - 1;
  lines.splice(insertIdx, 0, annotationText);
  return lines.join('\n');
}

/**
 * Try to auto-detect variable names from a line of C++ code.
 * Returns candidate variable names found in declarations.
 */
export function detectVariables(codeLine: string): string[] {
  const vars: string[] = [];
  // Match: Type* name = ...  or  Type name[] = ...  or  Type name = ...
  const ptrMatch = codeLine.match(/(\w+(?:\s*\*)+)\s*(\w+)\s*[=;(]/);
  if (ptrMatch) {
    vars.push(ptrMatch[2]);
  }
  // Also match simple declarations like "int n = 5"
  const simpleDecl = codeLine.match(/(?:int|size_t|unsigned)\s+(\w+)\s*=/);
  if (simpleDecl) {
    vars.push(simpleDecl[1]);
  }
  return vars;
}

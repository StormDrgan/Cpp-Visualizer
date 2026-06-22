"""LLDB Bridge walkers — data structure traversal commands.

Extracted from lldb_bridge.py to keep file sizes manageable.
These functions walk C++ data structures at runtime using the LLDB API.
"""

from __future__ import annotations
import json
import sys
import os

# Ensure LLDB Python bindings are importable
LLDB_PYTHON = "/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Versions/A/Resources/Python"
if LLDB_PYTHON not in sys.path:
    sys.path.insert(0, LLDB_PYTHON)

import lldb

# Import shared utilities from the bridge (uses late-import pattern:
# lldb_bridge defines these before importing from this module)
from lldb_bridge import log, send_response, _get_thread, _is_null


# ---------------------------------------------------------------------------
# Walk handlers — dispatched by handle_command in lldb_bridge.py
# ---------------------------------------------------------------------------

def handle_walk_linked_list(cmd: dict, ctx: dict) -> None:
    """Walk a linked list starting from root_var, following next_field.

    Uses LLDB's type system to read struct fields properly.
    """
    root_var = cmd.get("root_var", "")
    next_field = cmd.get("next_field", "next")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not root_var:
        send_response({"ok": False, "error": "No root_var provided"})
        return

    try:
        # Evaluate root variable to get address AND type
        root_val = frame.EvaluateExpression(root_var)
        if not root_val or root_val.GetError().Fail():
            send_response({"ok": False, "error": f"Failed to evaluate {root_var}"})
            return

        root_addr = str(root_val.GetValue() or "0x0")
        if _is_null(root_addr):
            send_response({"ok": True, "result": {"nodes": [], "cycle_detected": False}})
            return

        # Discover struct type from the variable type
        type_name = str(root_val.GetTypeName() or "")  # e.g., "ListNode *"
        struct_type = type_name.replace(" *", "").replace("*", "").strip()

        if not struct_type:
            send_response({"ok": False, "error": "Could not determine struct type from variable"})
            return

        # Walk the chain with proper types
        nodes, has_cycle = _walk_chain_typed(frame, root_addr, struct_type, next_field)
        send_response({"ok": True, "result": {"nodes": nodes, "cycle_detected": has_cycle}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def handle_walk_binary_tree(cmd: dict, ctx: dict) -> None:
    """Walk a binary tree starting from root_var, following left_field and right_field.

    Uses BFS to collect all nodes and their parent-child relationships.
    """
    root_var = cmd.get("root_var", "")
    left_field = cmd.get("left_field", "left")
    right_field = cmd.get("right_field", "right")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not root_var:
        send_response({"ok": False, "error": "No root_var provided"})
        return

    try:
        # Evaluate root variable to get address and type
        root_val = frame.EvaluateExpression(root_var)
        if not root_val or root_val.GetError().Fail():
            send_response({"ok": False, "error": f"Failed to evaluate {root_var}"})
            return

        root_addr = str(root_val.GetValue() or "0x0")
        if _is_null(root_addr):
            send_response({"ok": True, "result": {"nodes": [], "edges": []}})
            return

        # Discover struct type
        type_name = str(root_val.GetTypeName() or "")
        struct_type = type_name.replace(" *", "").replace("*", "").strip()

        if not struct_type:
            send_response({"ok": False, "error": "Could not determine struct type from variable"})
            return

        nodes, edges = _walk_tree_bfs(frame, root_addr, struct_type, left_field, right_field)
        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def handle_walk_array(cmd: dict, ctx: dict) -> None:
    """Walk a C++ array (stack or heap), reading each element by index.

    Supports both stack arrays (int arr[5]) and heap arrays (int* arr = new int[n]).
    The length_var can be a variable name or a literal integer.
    """
    var_name = cmd.get("var_name", "")
    length_var = cmd.get("length_var", "")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not var_name or not length_var:
        send_response({"ok": False, "error": "Missing var_name or length_var"})
        return

    try:
        # Resolve the array element count:
        # 1. First, get the actual array size from LLDB type info (most reliable).
        #    For stack arrays like int arr[8], the type string is "int[8]".
        #    For heap arrays like int* arr, there is no embedded size.
        # 2. Then try length_var as a variable name or literal integer.
        # 3. Use the smaller of the two, and never exceed a reasonable max.

        def _extract_size_from_type(var_name_expr: str, frame) -> int:
            """Extract array element count from LLDB type, e.g. int[8] → 8."""
            import re
            type_val = frame.EvaluateExpression(var_name_expr)
            if not type_val or type_val.GetError().Fail():
                return 0
            type_name = str(type_val.GetTypeName() or "")
            m = re.match(r'.+?\s*\[(\d+)\]', type_name)
            if m:
                return int(m.group(1))
            # Try sizeof division for pointer-based arrays
            size_result = frame.EvaluateExpression(
                f"(sizeof({var_name_expr}) / sizeof({var_name_expr}[0]))"
            )
            if size_result and size_result.GetError().Success():
                try:
                    return int(str(size_result.GetValue() or "0"))
                except ValueError:
                    pass
            return 0

        def _resolve_length_var(lvar: str, frame) -> int:
            """Resolve length: evaluate as variable, fall back to literal integer."""
            # Try evaluating as variable
            len_result = frame.EvaluateExpression(lvar)
            if len_result and len_result.GetError().Success():
                try:
                    return int(str(len_result.GetValue() or "0"))
                except ValueError:
                    pass
            # Try parsing as literal integer
            try:
                return int(lvar)
            except ValueError:
                pass
            return 0

        type_N = _extract_size_from_type(var_name, frame)

        # Resolve length from the length_var (variable or literal)
        var_N = _resolve_length_var(length_var, frame)

        # Pick the reliable count
        if type_N > 0 and var_N > 0:
            N = min(type_N, var_N)
        elif type_N > 0:
            N = type_N
        elif var_N > 0:
            N = var_N
        else:
            send_response({"ok": False,
                           "error": f"Cannot resolve array length: type_N={type_N}, var_N={var_N}"})
            return

        # Cap array size at 500 to prevent runaway loops from garbage values
        max_elements = 500
        if N > max_elements:
            N = max_elements

        nodes = []
        for i in range(N):
            # Read element value
            elem_expr = f"{var_name}[{i}]"
            elem_result = frame.EvaluateExpression(elem_expr)
            if not elem_result or elem_result.GetError().Fail():
                # Try treating var_name as a pointer: *(var_name + i)
                elem_expr2 = f"*({var_name} + {i})"
                elem_result = frame.EvaluateExpression(elem_expr2)
                if not elem_result or elem_result.GetError().Fail():
                    continue

            val_str = str(elem_result.GetValue() or "")
            summary = elem_result.GetSummary()

            # Read element address for pointer matching
            addr_expr = f"&{var_name}[{i}]"
            addr_result = frame.EvaluateExpression(addr_expr)
            addr = "0x0"
            if addr_result and addr_result.GetError().Success():
                addr = str(addr_result.GetValue() or "0x0")
            else:
                # Fallback: pointer arithmetic for address
                addr_expr2 = f"({var_name} + {i})"
                addr_result2 = frame.EvaluateExpression(addr_expr2)
                if addr_result2 and addr_result2.GetError().Success():
                    addr = str(addr_result2.GetValue() or "0x0")
                else:
                    addr = f"arr[{i}]"  # synthetic address

            # Clean value display
            display = str(summary).strip('"') if summary else val_str

            nodes.append({
                "addr": addr,
                "label": display,
                "fields": {"index": str(i), "val": display},
            })

        send_response({"ok": True, "result": {"nodes": nodes}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


# ---------------------------------------------------------------------------
# Tree / chain / graph / hashmap walker helpers
# ---------------------------------------------------------------------------

def _walk_tree_bfs(frame, root_addr: str, struct_type: str,
                   left_field: str, right_field: str) -> tuple[list[dict], list[dict]]:
    """BFS walk of a binary tree. Returns (nodes, edges)."""
    from collections import deque

    nodes = []
    edges = []
    visited = set()
    queue = deque()

    # Enqueue root with parent info
    queue.append((root_addr, -1))  # (addr, parent_index), -1 = no parent

    max_nodes = 200

    while queue and len(nodes) < max_nodes:
        addr, parent_idx = queue.popleft()

        if _is_null(addr) or addr in visited:
            continue

        visited.add(addr)
        node_idx = len(nodes)

        # Read fields via typed expression
        fields = {}
        label = f"{struct_type}@{addr[-4:]}"

        # Read 'val' field
        val_expr = f"(({struct_type}*){addr})->val"
        val_result = frame.EvaluateExpression(val_expr)
        if val_result and val_result.GetError().Success():
            val_str = str(val_result.GetValue() or "")
            fields["val"] = val_str
            label = f"{val_str}"

        # Read left child
        left_addr = "0x0"
        left_expr = f"(({struct_type}*){addr})->{left_field}"
        left_result = frame.EvaluateExpression(left_expr)
        if left_result and left_result.GetError().Success():
            left_addr = str(left_result.GetValue() or "0x0")
        fields[left_field] = left_addr

        # Read right child
        right_addr = "0x0"
        right_expr = f"(({struct_type}*){addr})->{right_field}"
        right_result = frame.EvaluateExpression(right_expr)
        if right_result and right_result.GetError().Success():
            right_addr = str(right_result.GetValue() or "0x0")
        fields[right_field] = right_addr

        nodes.append({
            "addr": addr,
            "label": label,
            "fields": fields,
        })

        # Record edge from parent
        if parent_idx >= 0:
            edges.append({
                "from_idx": parent_idx,
                "to_idx": node_idx,
            })

        # Enqueue children (null children are recorded as null sentinels for layout)
        if not _is_null(left_addr):
            queue.append((left_addr, node_idx))
        if not _is_null(right_addr):
            queue.append((right_addr, node_idx))

    return nodes, edges


def _walk_chain_typed(frame, start_addr: str, struct_type: str, next_field: str) -> tuple[list[dict], bool]:
    """Walk a linked chain using typed struct field access."""
    nodes = []
    visited = {}
    addr = start_addr
    step = 0
    max_steps = 200

    while not _is_null(addr) and step < max_steps:
        if addr in visited:
            return nodes, True

        visited[addr] = len(nodes)

        fields = {}
        label = f"{struct_type}@{addr[-4:]}"

        # Read ALL fields of the struct using typed expressions
        # Read 'val' field (first integer field, common in ListNode)
        val_expr = f"(({struct_type}*){addr})->val"
        val_result = frame.EvaluateExpression(val_expr)
        if val_result and val_result.GetError().Success():
            val_str = str(val_result.GetValue() or "")
            fields["val"] = val_str
            label = f"{struct_type}({val_str})"

        # Read the next pointer field
        next_expr = f"(({struct_type}*){addr})->{next_field}"
        next_result = frame.EvaluateExpression(next_expr)
        if next_result and next_result.GetError().Success():
            next_addr = str(next_result.GetValue() or "0x0")
            fields[next_field] = next_addr
        else:
            # Try reading as raw pointer at offset to discover fields
            raw_ptr = frame.EvaluateExpression(f"*((unsigned long long*)({addr} + 8))")
            if raw_ptr and raw_ptr.GetError().Success():
                fields[next_field] = str(raw_ptr.GetValue() or "0x0")

        nodes.append({
            "addr": addr,
            "label": label,
            "fields": fields,
        })

        # Move to next node
        new_addr = fields.get(next_field, "0x0")
        if new_addr == addr or _is_null(new_addr):
            break
        addr = new_addr
        step += 1

    return nodes, False


def handle_walk_graph(cmd: dict, ctx: dict) -> None:
    """Walk a graph structure — adjacency matrix or adjacency list.

    Command: {
        "cmd": "walk_graph",
        "root_var": "mat" or "adj_list",
        "mode": "matrix" | "adjlist",
        "size_var": "n"  // variable holding vertex count
    }
    """
    root_var = cmd.get("root_var", "")
    mode = cmd.get("mode", "adjlist")
    size_var = cmd.get("size_var", "n")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    try:
        # Resolve vertex count
        n_result = frame.EvaluateExpression(size_var)
        n = 5
        if n_result and n_result.GetError().Success():
            try:
                n = int(str(n_result.GetValue() or "5"))
            except ValueError:
                n = 5
        n = min(n, 50)

        if mode == "matrix":
            nodes, edges = _walk_adjacency_matrix(frame, root_var, n)
        else:
            nodes, edges = _walk_adjacency_list(frame, root_var, n)

        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        log(f"walk_graph error: {e}")
        send_response({"ok": False, "error": str(e)})


def _walk_adjacency_matrix(frame, mat_var: str, n: int) -> tuple[list[dict], list[dict]]:
    """Walk adjacency matrix — n vertices, edges where mat[i][j] != 0."""
    nodes = []
    edges = []

    for i in range(n):
        nodes.append({
            "addr": f"v:{i}",
            "label": str(i),
            "fields": {"val": str(i)},
        })

    for i in range(n):
        for j in range(n):
            elem_result = frame.EvaluateExpression(f"{mat_var}[{i}][{j}]")
            val = 0
            if elem_result and elem_result.GetError().Success():
                try:
                    val = int(str(elem_result.GetValue() or "0"))
                except ValueError:
                    pass
            if val != 0:
                edges.append({
                    "from_idx": i,
                    "to_idx": j,
                })

    return nodes, edges


def _walk_adjacency_list(frame, adj_var: str, n: int) -> tuple[list[dict], list[dict]]:
    """Walk adjacency list — array of linked lists, one per vertex."""
    nodes = []
    edges = []

    for i in range(n):
        nodes.append({
            "addr": f"v:{i}",
            "label": str(i),
            "fields": {"val": str(i)},
        })

    for i in range(n):
        # Evaluate head pointer of the i-th linked list
        head_result = frame.EvaluateExpression(f"{adj_var}[{i}]")
        if not head_result or head_result.GetError().Fail():
            continue

        head_addr = str(head_result.GetValue() or "0x0")
        if _is_null(head_addr):
            continue

        # Walk the linked list from head
        visited = set()
        addr = head_addr
        step = 0
        max_steps = 200

        while not _is_null(addr) and step < max_steps:
            if addr in visited:
                break
            visited.add(addr)

            # Try reading val as the first 4-byte int (raw pointer deref)
            val_expr = f"*((int*)({addr}))"
            val_result = frame.EvaluateExpression(val_expr)
            if val_result and val_result.GetError().Success():
                try:
                    to_vertex = int(str(val_result.GetValue() or "-1"))
                    if 0 <= to_vertex < n:
                        edges.append({
                            "from_idx": i,
                            "to_idx": to_vertex,
                        })
                except ValueError:
                    pass

            # Try reading next pointer at offset 8
            next_expr = f"*((unsigned long long*)({addr} + 8))"
            next_result = frame.EvaluateExpression(next_expr)
            if next_result and next_result.GetError().Success():
                addr = str(next_result.GetValue() or "0x0")
            else:
                break

            step += 1

    return nodes, edges


def handle_walk_hashmap(cmd: dict, ctx: dict) -> None:
    """Walk a hash table structure.

    Command: {
        "cmd": "walk_hashmap",
        "root_var": "table",
        "mode": "chaining" | "open_addressing"
    }
    """
    root_var = cmd.get("root_var", "")
    mode = cmd.get("mode", "chaining")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not root_var:
        send_response({"ok": False, "error": "No root_var provided"})
        return

    try:
        if mode == "chaining":
            nodes, edges = _walk_hashmap_chaining(frame, root_var)
        else:
            nodes, edges = _walk_hashmap_open_addressing(frame, root_var)

        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _walk_hashmap_chaining(frame, table_var: str) -> tuple[list[dict], list[dict]]:
    """Walk hashmap with chaining (array of bucket pointers, each to a linked list)."""
    nodes = []
    edges = []

    # Discover table size via sizeof
    size_result = frame.EvaluateExpression(f"(sizeof({table_var}) / sizeof({table_var}[0]))")
    table_size = 11
    if size_result and size_result.GetError().Success():
        try:
            table_size = int(str(size_result.GetValue() or "11"))
        except ValueError:
            pass
    table_size = min(table_size, 20)

    for i in range(table_size):
        bucket_addr = f"bucket:{i}"
        # Evaluate bucket head pointer
        head_result = frame.EvaluateExpression(f"{table_var}[{i}]")
        if not head_result or head_result.GetError().Fail():
            nodes.append({
                "addr": bucket_addr,
                "label": f"[{i}] empty",
                "fields": {"bucket_idx": str(i), "val": "empty"},
            })
            continue

        head_addr = str(head_result.GetValue() or "0x0")
        if _is_null(head_addr):
            nodes.append({
                "addr": bucket_addr,
                "label": f"[{i}]",
                "fields": {"bucket_idx": str(i), "val": ""},
            })
            continue

        # Label the bucket with first key if available
        first_key = ""
        first_key_result = frame.EvaluateExpression(f"*((int*)({head_addr}))")
        if first_key_result and first_key_result.GetError().Success():
            first_key = str(first_key_result.GetValue() or "")

        nodes.append({
            "addr": bucket_addr,
            "label": f"[{i}]" + (f":{first_key}" if first_key else ""),
            "fields": {"bucket_idx": str(i), "val": first_key},
        })

        bucket_node_idx = len(nodes) - 1

        # Walk the chain
        visited = set()
        addr = head_addr
        step = 0
        max_steps = 30

        while not _is_null(addr) and step < max_steps:
            if addr in visited:
                break
            visited.add(addr)

            # Read key (offset 0) and val (offset 4) as raw ints
            key_result = frame.EvaluateExpression(f"*((int*)({addr}))")
            key_str = "?"
            if key_result and key_result.GetError().Success():
                key_str = str(key_result.GetValue() or "?")

            val_result = frame.EvaluateExpression(f"*((int*)({addr} + 4))")
            val_str = "?"
            if val_result and val_result.GetError().Success():
                val_str = str(val_result.GetValue() or "?")

            chain_node = {
                "addr": addr,
                "label": f"{key_str}:{val_str}",
                "fields": {"key": key_str, "val": val_str},
            }
            nodes.append(chain_node)
            chain_idx = len(nodes) - 1

            # Edge from bucket to first chain node, or chain node to next
            if step == 0:
                edges.append({"from_idx": bucket_node_idx, "to_idx": chain_idx})
            else:
                edges.append({"from_idx": prev_chain_idx, "to_idx": chain_idx})

            prev_chain_idx = chain_idx

            # Read next pointer (offset 8)
            next_result = frame.EvaluateExpression(f"*((unsigned long long*)({addr} + 8))")
            if next_result and next_result.GetError().Success():
                addr = str(next_result.GetValue() or "0x0")
            else:
                break

            step += 1

    return nodes, edges


def _walk_hashmap_open_addressing(frame, table_var: str) -> tuple[list[dict], list[dict]]:
    """Walk hashmap with open addressing (linear probing)."""
    nodes = []
    edges = []

    size_result = frame.EvaluateExpression(f"(sizeof({table_var}) / sizeof({table_var}[0]))")
    table_size = 11
    if size_result and size_result.GetError().Success():
        try:
            table_size = int(str(size_result.GetValue() or "11"))
        except ValueError:
            pass
    table_size = min(table_size, 20)

    for i in range(table_size):
        key_result = frame.EvaluateExpression(f"{table_var}[{i}].key")
        key_str = "?"
        if key_result and key_result.GetError().Success():
            key_str = str(key_result.GetValue() or "?")

        val_result = frame.EvaluateExpression(f"{table_var}[{i}].val")
        val_str = "?"
        if val_result and val_result.GetError().Success():
            val_str = str(val_result.GetValue() or "?")

        # Check if slot is occupied
        is_empty = True
        occupied_result = frame.EvaluateExpression(f"{table_var}[{i}].occupied")
        if occupied_result and occupied_result.GetError().Success():
            occ_val = str(occupied_result.GetValue() or "")
            is_empty = occ_val in ("false", "False", "0", "0x0", "")

        node_label = f"[{i}] {key_str}:{val_str}" if not is_empty else f"[{i}] empty"
        nodes.append({
            "addr": f"slot:{i}",
            "label": node_label,
            "fields": {"slot_idx": str(i), "key": key_str, "val": val_str, "empty": str(is_empty).lower()},
        })

    return nodes, edges


def handle_walk_b_tree(cmd: dict, ctx: dict) -> None:
    """Walk a B-tree/B+tree starting from root_var.

    Reads keys[] and children[] arrays from each node.
    Command params:
      - root_var: root pointer variable name
      - order: B-tree order m (default 3)
      - is_bplus: bool (default False) — if True, treat as B+tree
    """
    root_var = cmd.get("root_var", "")
    order = int(cmd.get("order", 3))
    is_bplus = cmd.get("is_bplus", False)
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not root_var:
        send_response({"ok": False, "error": "No root_var provided"})
        return

    try:
        root_val = frame.EvaluateExpression(root_var)
        if not root_val or root_val.GetError().Fail():
            send_response({"ok": False, "error": f"Failed to evaluate {root_var}"})
            return

        root_addr = str(root_val.GetValue() or "0x0")
        if _is_null(root_addr):
            send_response({"ok": True, "result": {"nodes": [], "edges": []}})
            return

        type_name = str(root_val.GetTypeName() or "")
        struct_type = type_name.replace(" *", "").replace("*", "").strip()

        if not struct_type:
            send_response({"ok": False, "error": "Could not determine struct type"})
            return

        nodes, edges = _walk_b_tree_bfs(frame, root_addr, struct_type, order, is_bplus)
        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _walk_b_tree_bfs(frame, root_addr: str, struct_type: str,
                     order: int, is_bplus: bool) -> tuple[list[dict], list[dict]]:
    """BFS walk of a B-tree/B+tree. Returns (nodes, edges)."""
    from collections import deque

    nodes = []
    edges = []
    visited = set()
    queue = deque()
    queue.append((root_addr, -1, -1))  # (addr, parent_idx, child_slot)

    max_nodes = 200
    max_keys = order * 2
    max_children = order * 2 + 1

    while queue and len(nodes) < max_nodes:
        addr, parent_idx, child_slot = queue.popleft()

        if _is_null(addr) or addr in visited:
            continue

        visited.add(addr)
        node_idx = len(nodes)

        fields = {}

        # Read key count field (try common names)
        count = 0
        for cnt_field in ("n", "num_keys", "count", "size", "key_count", "numKeys"):
            cnt_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->{cnt_field}")
            if cnt_result and cnt_result.GetError().Success():
                try:
                    count = int(str(cnt_result.GetValue() or "0"))
                    break
                except ValueError:
                    pass

        if count < 0 or count > max_keys:
            count = 0

        # Try reading val/key/data as fallback (for simpler tree nodes)
        if count == 0:
            for val_field in ("val", "key", "data"):
                val_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->{val_field}")
                if val_result and val_result.GetError().Success():
                    val_str = str(val_result.GetValue() or "")
                    if val_str and val_str != "0":
                        fields["val"] = val_str
                        count = 1
                        break

        # Read keys array
        key_labels = []
        for i in range(min(count, max_keys)):
            key_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->keys[{i}]")
            if key_result and key_result.GetError().Success():
                key_str = str(key_result.GetValue() or "")
                fields[f"key_{i}"] = key_str
                key_labels.append(key_str)

        # Check if leaf
        is_leaf = False
        for leaf_field in ("leaf", "is_leaf", "isLeaf"):
            leaf_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->{leaf_field}")
            if leaf_result and leaf_result.GetError().Success():
                leaf_val = str(leaf_result.GetValue() or "")
                is_leaf = leaf_val in ("true", "True", "1")
                break

        fields["_is_leaf"] = str(is_leaf).lower()
        fields["_count"] = str(count)

        if key_labels:
            label = " | ".join(key_labels)
        elif "val" in fields:
            label = fields["val"]
        else:
            label = f"BNode@{addr[-4:]}"

        nodes.append({
            "addr": addr,
            "label": label,
            "fields": fields,
        })

        if parent_idx >= 0:
            edges.append({
                "from_idx": parent_idx,
                "to_idx": node_idx,
                "child_side": str(child_slot),
            })

        # Enqueue children
        if not is_leaf:
            for i in range(min(count + 1, max_children)):
                child_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->children[{i}]")
                if child_result and child_result.GetError().Success():
                    child_addr = str(child_result.GetValue() or "0x0")
                    if not _is_null(child_addr) and child_addr not in visited:
                        queue.append((child_addr, node_idx, i))

        # B+tree leaf sibling pointer
        if is_bplus and is_leaf:
            for sib_field in ("next", "sibling", "next_leaf"):
                sib_result = frame.EvaluateExpression(f"(({struct_type}*){addr})->{sib_field}")
                if sib_result and sib_result.GetError().Success():
                    sib_addr = str(sib_result.GetValue() or "0x0")
                    if not _is_null(sib_addr) and sib_addr not in visited:
                        fields["_sibling"] = sib_addr

    return nodes, edges


def handle_inspect_type(cmd: dict, ctx: dict) -> None:
    """Inspect a C++ struct type and return its field layout.

    Used by auto-detection to discover linked-list / binary-tree candidates
    without manual @viz annotations.

    Command: {"cmd": "inspect_type", "type_name": "ListNode"}
    Response: {
        "ok": true,
        "result": {
            "type_name": "ListNode",
            "fields": [
                {"name": "val", "type": "int", "is_pointer": false, "points_to_same_type": false},
                {"name": "next", "type": "ListNode *", "is_pointer": true, "points_to_same_type": true}
            ]
        }
    }
    """
    type_name = cmd.get("type_name", "")
    target = ctx.get("target")

    if not target:
        send_response({"ok": False, "error": "No target"})
        return

    if not type_name:
        send_response({"ok": False, "error": "Missing type_name"})
        return

    # Strip trailing whitespace / pointer asterisk
    clean_name = type_name.strip()
    if clean_name.endswith("*") or clean_name.endswith(" *"):
        clean_name = clean_name.rstrip("*").strip()

    try:
        sbtype = target.FindFirstType(clean_name)
        if not sbtype or not sbtype.IsValid():
            send_response({"ok": False, "error": f"Type not found: {clean_name}"})
            return

        fields = []
        for i in range(sbtype.GetNumberOfFields()):
            field = sbtype.GetFieldAtIndex(i)
            field_name = field.GetName() or ""
            field_type = field.GetType()
            field_type_name = str(field_type.GetName() or "")

            is_pointer = field_type_name.endswith("*") or field_type_name.endswith(" *")

            points_to_same = False
            if is_pointer:
                pointee = field_type.GetPointeeType()
                if pointee and pointee.IsValid():
                    pointee_name = str(pointee.GetName() or "")
                    points_to_same = (pointee_name == clean_name)

            fields.append({
                "name": field_name,
                "type": field_type_name,
                "is_pointer": is_pointer,
                "points_to_same_type": points_to_same,
            })

        send_response({"ok": True, "result": {"type_name": clean_name, "fields": fields}})

    except Exception as e:
        log(f"inspect_type error: {e}")
        send_response({"ok": False, "error": str(e)})

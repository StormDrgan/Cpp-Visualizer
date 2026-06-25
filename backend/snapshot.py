"""State snapshot — builds the JSON snapshot returned to the frontend.

See DESIGN.md §3.4 for the full StateSnapshot schema.
"""

from __future__ import annotations
from memory_walker import MemoryWalker, TraversalResult, TreeEdge
from annotations import Annotation, get_show_vars


def build_snapshot(
    step_number: int,
    debugger_state,  # DebuggerState from debugger.py
    source_file: str = "main.cpp",
    *,
    annotations: list[Annotation] | None = None,
    walker: MemoryWalker | None = None,
    selected_vars: list[str] | None = None,  # §v0.8: user-selected variable names
    prev_call_stack: list | None = None,  # previous step's call_stack for recursion tree diff
) -> dict:
    """Convert a DebuggerState into the frontend StateSnapshot JSON.

    Args:
        step_number: Which step this snapshot represents (1-indexed).
        debugger_state: DebuggerState from the LLDB controller.
        source_file: Original source filename.
        annotations: Parsed @viz annotations.
        walker: MemoryWalker instance (optional, only if annotations present).

    Returns:
        Dict matching the DESIGN.md §3.4 schema.
    """
    # Locals
    locals_list = []
    for var in debugger_state.locals:
        locals_list.append({
            "name": var.name,
            "type": var.type,
            "value": var.value,
            "display_value": var.display_value or var.value,
            "is_pointer": var.is_pointer,
            "deref_type": var.deref_type,
        })

    # Call stack
    call_stack_list = []
    for frame in debugger_state.call_stack:
        call_stack_list.append({
            "function": frame.function,
            "line": frame.line,
            "file": frame.file or source_file,
        })

    # Heap structures — walk data structures if annotations and walker are provided
    heap_structures = _build_heap_structures(annotations, walker, debugger_state,
                                              step_number=step_number,
                                              selected_vars=selected_vars,
                                              prev_call_stack=prev_call_stack)

    # Candidates: auto-discovered variable names + inferred types,
    # so the front-end can render a checkbox list (§v0.8 click-to-select).
    candidates = _build_candidates(heap_structures)

    # v0.9: generate operation summary from current state
    operation_summary = debugger_state.current_function or ""
    if debugger_state.source_line:
        operation_summary = f"{operation_summary}:{debugger_state.source_line}"

    snapshot = {
        "step_number": step_number,
        "source_line": debugger_state.source_line,
        "file": debugger_state.file or source_file,
        "current_function": debugger_state.current_function,
        "call_stack": call_stack_list,
        "locals": locals_list,
        "heap_structures": heap_structures,
        "candidates": candidates,
        "stdout": getattr(debugger_state, "stdout", ""),
        "is_terminated": debugger_state.is_terminated,
        "exit_code": debugger_state.exit_code,
        "operation_summary": operation_summary,
    }

    return snapshot


def _build_heap_structures(
    annotations: list[Annotation] | None,
    walker: MemoryWalker | None,
    debugger_state=None,  # DebuggerState, for auto-discovery
    *,
    step_number: int = 0,
    selected_vars: list[str] | None = None,  # §v0.8: user-selected var names
    prev_call_stack: list | None = None,  # previous step's call_stack for recursion tree
) -> list[dict]:
    """Build heap_structures from annotations using the MemoryWalker.

    If no struct-type annotations (linked_list, binary_tree, array) are
    found, attempts auto-discovery from the debugger state's local variables.
    Manual @viz annotations always take priority.

    When selected_vars is provided (§v0.8), auto-discovered annotations are
    filtered to only include those whose root variable is in the list.
    """
    if not walker:
        return []

    all_annotations = list(annotations or [])

    # Check if user provided any struct-type annotations
    has_struct = any(
        ann.struct_type in ("linked_list", "binary_tree", "array",
                            "stack", "queue", "heap", "graph", "hashmap",
                            "b_tree", "bplustree")
        for ann in all_annotations
    )

    # Auto-discover if no struct annotations and we have debugger state.
    # Skip on step 1: at the first line of main(), zero user code has executed,
    # so all local pointer values are uninitialized stack garbage.
    if not has_struct and debugger_state and step_number > 1:
        discovered = walker.auto_discover(debugger_state.locals)
        # §v0.8: filter auto-discovered annotations by user selection
        if selected_vars is not None:
            sv_set = set(selected_vars)
            discovered = [a for a in discovered
                          if a.struct_type == "show"  # always keep show
                          or a.root_var in sv_set]
        all_annotations.extend(discovered)
        if discovered:
            pass  # auto_discover already handles auto-show

    show_vars_list = get_show_vars(all_annotations)
    structures = []

    for ann in all_annotations:
        if ann.struct_type == "linked_list":
            result = walker.walk_linked_list(
                annotation_name=ann.name,
                root_var=ann.root_var,
                next_field=ann.next_field,
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            # v0.9: thread prev_field from annotation
            if ann.prev_field:
                sdict["prev_field"] = ann.prev_field
            structures.append(sdict)
        elif ann.struct_type == "binary_tree":
            result = walker.walk_binary_tree(
                annotation_name=ann.name,
                root_var=ann.root_var,
                left_field=ann.left_field or "left",
                right_field=ann.right_field or "right",
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            # v0.9: thread tree_variant from annotation
            if ann.tree_variant:
                sdict["tree_variant"] = ann.tree_variant
            structures.append(sdict)
        elif ann.struct_type == "array":
            result = walker.walk_array(
                annotation_name=ann.name,
                root_var=ann.root_var,
                length_var=ann.length_var,
                show_vars=show_vars_list,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "stack":
            # Sequential stack: reuse array walker; linked stack: reuse linked_list walker
            if ann.next_field:
                # Linked stack (pointer-based)
                result = walker.walk_linked_list(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    next_field=ann.next_field,
                    show_vars=show_vars_list,
                )
            else:
                # Sequential stack (array-based)
                result = walker.walk_array(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    # top is a 0-based index — add 1 to get element count.
                    # LLDB evaluates e.g. (top)+1 → 5 when top=4 (5 elements).
                    length_var=f"({ann.top_var}) + 1",
                    show_vars=show_vars_list,
                )
            sdict = _traversal_to_dict(result)
            sdict["structure_type"] = "stack"  # override walk_array/linked_list default
            structures.append(sdict)
        elif ann.struct_type == "queue":
            # Circular queue: reuse array; linked queue: reuse linked_list
            if ann.next_field:
                # Linked queue (pointer-based)
                result = walker.walk_linked_list(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    next_field=ann.next_field,
                    show_vars=show_vars_list,
                )
            else:
                # Circular queue (array-based) — walk full capacity
                result = walker.walk_array(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    length_var=ann.length_var or ann.rear_var,
                    show_vars=show_vars_list,
                )
            sdict = _traversal_to_dict(result)
            sdict["structure_type"] = "queue"  # override walk_array/linked_list default
            structures.append(sdict)
        elif ann.struct_type == "heap":
            # Binary heap (array-based) — walk the array, render as tree
            result = walker.walk_array(
                annotation_name=ann.name,
                root_var=ann.root_var,
                length_var=ann.length_var,
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            sdict["structure_type"] = "heap"  # override walk_array default
            structures.append(sdict)
        elif ann.struct_type == "graph":
            result = walker.walk_graph(
                annotation_name=ann.name,
                root_var=ann.root_var,
                mode=ann.mode or "adjlist",
                size_var=ann.length_var,
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            # v0.9: compute traversal coloring from watched pointer positions
            _compute_graph_traversal_colors(sdict, result, show_vars_list)
            structures.append(sdict)
        elif ann.struct_type == "hashmap":
            result = walker.walk_hashmap(
                annotation_name=ann.name,
                root_var=ann.root_var,
                mode=ann.mode or "chaining",
                show_vars=show_vars_list,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "b_tree":
            order = int(ann.length_var or "3")
            result = walker.walk_b_tree(
                annotation_name=ann.name,
                root_var=ann.root_var,
                order=order,
                is_bplus=False,
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            sdict["order"] = order
            structures.append(sdict)
        elif ann.struct_type == "bplustree":
            order = int(ann.length_var or "4")
            result = walker.walk_b_tree(
                annotation_name=ann.name,
                root_var=ann.root_var,
                order=order,
                is_bplus=True,
                show_vars=show_vars_list,
            )
            sdict = _traversal_to_dict(result)
            sdict["order"] = order
            structures.append(sdict)
        elif ann.struct_type == "recursion_tree":
            # v0.9: recursion tree from call stack
            if debugger_state:
                result = walker.walk_recursion(
                    annotation_name=ann.name,
                    call_stack=debugger_state.call_stack,
                    prev_call_stack=prev_call_stack,
                )
                sdict = _traversal_to_dict(result)
                sdict["structure_type"] = "recursion_tree"
                structures.append(sdict)

    # Post-process: deduplicate structures with overlapping node address sets
    # and filter out empty structures (null-pointer roots that walked 0 nodes).
    structures = _dedup_structures(structures)

    return structures


def _dedup_structures(structures: list[dict]) -> list[dict]:
    """Deduplicate structures by node address set.

    Structures with identical node address sets are merged: the first one
    is kept as the primary, and additional root variables (extracted from
    annotation_name) are added as pointer labels on the root nodes.

    Subset structures are merged into their superset.

    Structures with zero nodes (null-pointer walk results) are dropped.
    """
    if len(structures) <= 1:
        return [s for s in structures if len(s.get("nodes", [])) > 0]

    # Only dedup linked_list and binary_tree — array/stack/queue/graph/hashmap
    # have different semantics (index-based, not address-based).
    DEDUP_TYPES = {"linked_list", "binary_tree", "b_tree", "bplustree"}

    # Separate structures into dedup-eligible and pass-through
    eligible: list[dict] = []
    passthrough: list[dict] = []

    for s in structures:
        if s.get("structure_type") in DEDUP_TYPES:
            eligible.append(s)
        else:
            passthrough.append(s)

    if len(eligible) <= 1:
        # Still filter empty
        eligible = [s for s in eligible if len(s.get("nodes", [])) > 0]
        return eligible + passthrough

    # Build node address frozensets for each eligible structure
    struct_sets: list[tuple[dict, frozenset, int]] = []  # (struct, frozenset, original_index)
    for i, s in enumerate(eligible):
        addrs = frozenset(n["addr"] for n in s.get("nodes", []))
        struct_sets.append((s, addrs, i))

    # Sort by set size descending so supersets process first;
    # this way subsets naturally merge into their superset.
    struct_sets.sort(key=lambda x: len(x[1]), reverse=True)

    merged: list[dict] = []
    consumed: set[int] = set()

    for i, (s_i, set_i, _orig_i) in enumerate(struct_sets):
        if i in consumed:
            continue

        nodes_i = s_i.get("nodes", [])
        if len(nodes_i) == 0:
            consumed.add(i)
            continue

        # Collect pointer labels from structures that merge into this one
        extra_labels: dict[str, list[str]] = {}  # addr → [var_names]

        for j, (s_j, set_j, _orig_j) in enumerate(struct_sets):
            if j == i or j in consumed:
                continue
            if not set_j:
                consumed.add(j)
                continue

            if set_j == set_i:
                # Exact match → merge s_j into s_i
                _collect_labels(s_j, extra_labels)
                consumed.add(j)
            elif set_j.issubset(set_i):
                # Subset → merge s_j into s_i
                _collect_labels(s_j, extra_labels)
                consumed.add(j)

        # Add the primary structure's own root as a pointer label on the root node
        own_root = s_i.get("annotation_name", "").replace("auto_", "")
        own_root_addr = s_i.get("root_node_addr", "0x0")
        if own_root and own_root_addr and own_root_addr != "0x0":
            extra_labels.setdefault(own_root_addr, []).append(own_root)

        # Apply collected pointer labels to s_i's nodes
        if extra_labels:
            for n in s_i.get("nodes", []):
                addr = n["addr"]
                extra = extra_labels.get(addr, [])
                if extra:
                    existing = list(n.get("pointers_pointing_here", []))
                    for p in extra:
                        if p not in existing:
                            existing.append(p)
                    n["pointers_pointing_here"] = existing

        merged.append(s_i)
        consumed.add(i)

    return merged + passthrough


def _collect_labels(struct: dict, labels: dict[str, list[str]]) -> None:
    """Collect pointer labels from a structure that is being merged away.

    Extracts:
    - The structure's root variable name (from annotation_name, stripping "auto_")
    - All pointers_pointing_here from its nodes
    """
    # Root variable name
    ann_name = struct.get("annotation_name", "")
    root_var = ann_name.replace("auto_", "")

    root_addr = struct.get("root_node_addr", "0x0")
    if root_addr and root_addr != "0x0" and root_var:
        labels.setdefault(root_addr, []).append(root_var)

    # Pointers pointing to individual nodes
    for n in struct.get("nodes", []):
        addr = n["addr"]
        ptrs = n.get("pointers_pointing_here", [])
        if ptrs:
            labels.setdefault(addr, []).extend(ptrs)


def _build_candidates(heap_structures: list[dict]) -> list[dict]:
    """Extract candidate variable list from built heap_structures.

    Each candidate represents a variable that can be toggled on/off
    in the front-end's visualization target panel (§v0.8).

    Scans both the primary annotation_name AND merged-in pointer labels
    from nodes' pointers_pointing_here (added by _dedup_structures when
    multiple variables point to overlapping node sets).
    """
    candidates: list[dict] = []
    seen: set[str] = set()  # deduplicate by var_name

    def _add(var_name: str, s: dict, root_addr: str = "") -> None:
        """Add a candidate if not already seen."""
        nonlocal seen, candidates
        if not var_name or var_name in seen:
            return
        seen.add(var_name)
        candidates.append({
            "var_name": var_name,
            "struct_type": s.get("structure_type", "unknown"),
            "node_count": len(s.get("nodes", [])),
            "root_addr": root_addr or s.get("root_node_addr", "0x0"),
        })

    for s in heap_structures:
        # Primary root variable name from annotation_name (strip "auto_" prefix)
        ann_name = s.get("annotation_name", "")
        primary_var = ann_name.replace("auto_", "")
        _add(primary_var, s)

        # Also harvest merged-in variable names from nodes' pointer labels.
        # When _dedup_structures merges structures with overlapping node
        # sets, it preserves the extra root vars as pointers_pointing_here
        # on the relevant nodes.  These need to appear as candidates too.
        for n in s.get("nodes", []):
            for ptr_name in n.get("pointers_pointing_here", []):
                _add(ptr_name, s, root_addr=n.get("addr", "0x0"))

    return candidates


def _traversal_to_dict(result: TraversalResult) -> dict:
    """Convert a TraversalResult to the frontend JSON dict."""
    nodes = []
    for n in result.nodes:
        nodes.append({
            "addr": n.addr,
            "label": n.label,
            "fields": n.fields,
            "pointers_pointing_here": n.pointers_pointing_here,
        })

    edges = []
    for e in result.edges:
        edges.append({
            "from_idx": e.from_idx,
            "to_idx": e.to_idx,
            "child_side": e.child_side,
        })

    return {
        "annotation_name": result.annotation_name,
        "structure_type": result.structure_type,
        "root_node_addr": result.root_node_addr,
        "nodes": nodes,
        "edges": edges,
        "cycle_detected": result.cycle_detected,
    }

def _compute_graph_traversal_colors(
    sdict: dict,
    result,
    show_vars: list[str],
) -> None:
    """Compute progressive coloring for graph traversal visualization.

    Analyzes show variable positions to determine which nodes have been
    "visited" and assigns gradient colors based on visit order/layer.
    BFS: light-blue → deep-blue gradient by layer.
    DFS: light-purple → deep-purple gradient by depth.
    """
    if not show_vars or not result.nodes:
        return

    nodes = result.nodes
    traversal_state: dict[str, str] = {}

    # Build a map from watched var name → node addr it points to
    ptr_to_addr: dict[str, str] = {}
    for node in nodes:
        for ptr in node.pointers_pointing_here:
            ptr_to_addr[ptr] = node.addr

    # Collect visited nodes (those with a watched pointer on them)
    visited_addrs: list[str] = []
    visited_order: dict[str, int] = {}
    for i, node in enumerate(nodes):
        if node.pointers_pointing_here:
            visited_addrs.append(node.addr)
            visited_order[node.addr] = len(visited_order)

    if len(visited_addrs) < 2:
        return

    # BFS coloring: gradient by visit order (layer-by-layer)
    for addr in visited_addrs:
        order = visited_order.get(addr, 0)
        total = max(len(visited_addrs) - 1, 1)
        ratio = order / total
        # Light blue (#bbdefb) → deep blue (#1565c0)
        r = int(0xbb - (0xbb - 0x15) * ratio)
        g = int(0xde - (0xde - 0x65) * ratio)
        b = int(0xfb - (0xfb - 0xc0) * ratio)
        traversal_state[addr] = f"#{r:02x}{g:02x}{b:02x}"

    sdict["traversal_state"] = traversal_state

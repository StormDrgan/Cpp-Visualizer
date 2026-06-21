"""State snapshot — builds the JSON snapshot returned to the frontend.

See DESIGN.md §3.4 for the full StateSnapshot schema.
"""

from __future__ import annotations
from memory_walker import MemoryWalker, TraversalResult, TreeEdge
from annotations import Annotation, get_watched_vars


def build_snapshot(
    step_number: int,
    debugger_state,  # DebuggerState from debugger.py
    source_file: str = "main.cpp",
    *,
    annotations: list[Annotation] | None = None,
    walker: MemoryWalker | None = None,
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
    heap_structures = _build_heap_structures(annotations, walker, debugger_state)

    snapshot = {
        "step_number": step_number,
        "source_line": debugger_state.source_line,
        "file": debugger_state.file or source_file,
        "current_function": debugger_state.current_function,
        "call_stack": call_stack_list,
        "locals": locals_list,
        "watched_expressions": [],
        "heap_structures": heap_structures,
        "stdout": getattr(debugger_state, "stdout", ""),
        "is_terminated": debugger_state.is_terminated,
        "exit_code": debugger_state.exit_code,
    }

    return snapshot


def _build_heap_structures(
    annotations: list[Annotation] | None,
    walker: MemoryWalker | None,
    debugger_state=None,  # DebuggerState, for auto-discovery
) -> list[dict]:
    """Build heap_structures from annotations using the MemoryWalker.

    If no struct-type annotations (linked_list, binary_tree, array) are
    found, attempts auto-discovery from the debugger state's local variables.
    Manual @viz annotations always take priority.
    """
    if not walker:
        return []

    all_annotations = list(annotations or [])

    # Check if user provided any struct-type annotations
    has_struct = any(
        ann.struct_type in ("linked_list", "binary_tree", "array",
                            "stack", "queue", "heap", "graph", "hashmap")
        for ann in all_annotations
    )

    # Auto-discover if no struct annotations and we have debugger state
    if not has_struct and debugger_state:
        discovered = walker.auto_discover(debugger_state.locals)
        all_annotations.extend(discovered)
        if discovered:
            pass  # auto_discover already handles auto-watch

    watched = get_watched_vars(all_annotations)
    structures = []

    for ann in all_annotations:
        if ann.struct_type == "linked_list":
            result = walker.walk_linked_list(
                annotation_name=ann.name,
                root_var=ann.root_var,
                next_field=ann.next_field,
                watched_vars=watched,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "binary_tree":
            result = walker.walk_binary_tree(
                annotation_name=ann.name,
                root_var=ann.root_var,
                left_field=ann.left_field or "left",
                right_field=ann.right_field or "right",
                watched_vars=watched,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "array":
            result = walker.walk_array(
                annotation_name=ann.name,
                root_var=ann.root_var,
                length_var=ann.length_var,
                watched_vars=watched,
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
                    watched_vars=watched,
                )
            else:
                # Sequential stack (array-based)
                result = walker.walk_array(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    length_var=ann.top_var,  # top index determines visible elements
                    watched_vars=watched,
                )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "queue":
            # Circular queue: reuse array; linked queue: reuse linked_list
            if ann.next_field:
                # Linked queue (pointer-based)
                result = walker.walk_linked_list(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    next_field=ann.next_field,
                    watched_vars=watched,
                )
            else:
                # Circular queue (array-based) — walk full capacity
                result = walker.walk_array(
                    annotation_name=ann.name,
                    root_var=ann.root_var,
                    length_var=ann.length_var or ann.rear_var,
                    watched_vars=watched,
                )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "heap":
            # Binary heap (array-based) — walk the array, render as tree
            result = walker.walk_array(
                annotation_name=ann.name,
                root_var=ann.root_var,
                length_var=ann.length_var,
                watched_vars=watched,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "graph":
            result = walker.walk_graph(
                annotation_name=ann.name,
                root_var=ann.root_var,
                mode=ann.mode or "adjlist",
                size_var=ann.length_var,
                watched_vars=watched,
            )
            structures.append(_traversal_to_dict(result))
        elif ann.struct_type == "hashmap":
            result = walker.walk_hashmap(
                annotation_name=ann.name,
                root_var=ann.root_var,
                mode=ann.mode or "chaining",
                watched_vars=watched,
            )
            structures.append(_traversal_to_dict(result))

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
    DEDUP_TYPES = {"linked_list", "binary_tree"}

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

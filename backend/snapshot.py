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
        "stdout": "",
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

    return structures


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

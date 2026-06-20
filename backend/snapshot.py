"""State snapshot — builds the JSON snapshot returned to the frontend.

See DESIGN.md §3.4 for the full StateSnapshot schema.
"""

from __future__ import annotations
from memory_walker import MemoryWalker, TraversalResult
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
    heap_structures = _build_heap_structures(annotations, walker)

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
) -> list[dict]:
    """Build heap_structures from annotations using the MemoryWalker."""
    if not annotations or not walker:
        return []

    watched = get_watched_vars(annotations)
    structures = []

    for ann in annotations:
        if ann.struct_type == "linked_list":
            result = walker.walk_linked_list(
                annotation_name=ann.name,
                root_var=ann.root_var,
                next_field=ann.next_field,
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

    return {
        "annotation_name": result.annotation_name,
        "structure_type": result.structure_type,
        "root_node_addr": result.root_node_addr,
        "nodes": nodes,
        "cycle_detected": result.cycle_detected,
    }

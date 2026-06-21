"""Snapshot diff engine — compares two StateSnapshot heap_structures
and produces a list of diff actions for the frontend to animate.

See DESIGN.md §6.3 for the full diff detection and animation mapping.
"""

from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class DiffAction:
    """A single detected change between two snapshots."""
    action: str            # node_created | node_removed | value_changed | pointer_relocated |
                           # no_change | element_compared | element_swapped
    structure_name: str    # which annotation structure this belongs to
    node_addr: str = ""    # which node is affected
    detail: dict = field(default_factory=dict)  # action-specific data


def compute_diff(
    prev_structures: list[dict],
    curr_structures: list[dict],
    watched_vars: list[str] | None = None,
) -> list[DiffAction]:
    """Compare two sets of heap_structures and return diff actions.

    Args:
        prev_structures: The previous snapshot's heap_structures list.
        curr_structures: The current snapshot's heap_structures list.

    Returns:
        List of DiffAction objects for frontend animation.
    """
    if not prev_structures:
        # First snapshot — everything is "created"
        actions = []
        for struct in curr_structures:
            for node in struct.get("nodes", []):
                actions.append(DiffAction(
                    action="node_created",
                    structure_name=struct.get("annotation_name", ""),
                    node_addr=node.get("addr", ""),
                ))
            # Also record initial pointer positions
            for node in struct.get("nodes", []):
                for ptr in node.get("pointers_pointing_here", []):
                    actions.append(DiffAction(
                        action="pointer_relocated",
                        structure_name=struct.get("annotation_name", ""),
                        node_addr=node.get("addr", ""),
                        detail={"pointer": ptr, "from_addr": None, "to_addr": node.get("addr", "")},
                    ))
        return actions

    if not curr_structures:
        return []

    actions: list[DiffAction] = []

    # Match structures by annotation_name
    prev_by_name = {s.get("annotation_name", ""): s for s in prev_structures}
    curr_by_name = {s.get("annotation_name", ""): s for s in curr_structures}

    for name, curr_struct in curr_by_name.items():
        prev_struct = prev_by_name.get(name)

        if prev_struct is None:
            # New structure entirely
            for node in curr_struct.get("nodes", []):
                actions.append(DiffAction(
                    action="node_created",
                    structure_name=name,
                    node_addr=node.get("addr", ""),
                ))
            continue

        prev_nodes = {n["addr"]: n for n in prev_struct.get("nodes", [])}
        curr_nodes = {n["addr"]: n for n in curr_struct.get("nodes", [])}

        # Node created
        for addr in curr_nodes:
            if addr not in prev_nodes:
                actions.append(DiffAction(
                    action="node_created",
                    structure_name=name,
                    node_addr=addr,
                ))

        # Node removed
        for addr in prev_nodes:
            if addr not in curr_nodes:
                actions.append(DiffAction(
                    action="node_removed",
                    structure_name=name,
                    node_addr=addr,
                ))

        # Value changed (common nodes, different non-pointer fields)
        for addr in set(prev_nodes) & set(curr_nodes):
            prev_fields = prev_nodes[addr].get("fields", {})
            curr_fields = curr_nodes[addr].get("fields", {})
            changed = {}
            for key in curr_fields:
                if key in prev_fields and str(prev_fields[key]) != str(curr_fields[key]):
                    changed[key] = {
                        "old": str(prev_fields[key]),
                        "new": str(curr_fields[key]),
                    }
            if changed:
                actions.append(DiffAction(
                    action="value_changed",
                    structure_name=name,
                    node_addr=addr,
                    detail={"changed_fields": changed},
                ))

        # Pointer relocated
        prev_pointers: dict[str, str] = {}
        for n in prev_struct.get("nodes", []):
            for ptr in n.get("pointers_pointing_here", []):
                prev_pointers[ptr] = n["addr"]

        curr_pointers: dict[str, str] = {}
        for n in curr_struct.get("nodes", []):
            for ptr in n.get("pointers_pointing_here", []):
                curr_pointers[ptr] = n["addr"]

        for ptr in set(prev_pointers) | set(curr_pointers):
            from_addr = prev_pointers.get(ptr)
            to_addr = curr_pointers.get(ptr)
            if from_addr != to_addr:
                actions.append(DiffAction(
                    action="pointer_relocated",
                    structure_name=name,
                    node_addr=to_addr or from_addr or "",
                    detail={"pointer": ptr, "from_addr": from_addr, "to_addr": to_addr},
                ))

    # ------------------------------------------------------------------
    # Post-processing: sort-action detection via watched pointer positions
    # ------------------------------------------------------------------
    # Uses pointers_pointing_here on nodes + watched_vars to directly
    # detect sorting comparisons and swaps, rather than relying solely on
    # cross-matching value_changed actions.
    for name, curr_struct in curr_by_name.items():
        prev_struct = prev_by_name.get(name)
        if prev_struct is None:
            continue
        sort_actions = _detect_sort_actions(prev_struct, curr_struct, watched_vars)
        if sort_actions:
            # Replace individual value_changed actions that are part of swaps
            swapped_addrs: set[str] = set()
            for sa in sort_actions:
                if sa.action == "element_swapped":
                    swapped_addrs.update(sa.node_addr.split(","))
            if swapped_addrs:
                actions = [a for a in actions
                           if not (a.action == "value_changed" and a.node_addr in swapped_addrs)]
            actions.extend(sort_actions)

    # ------------------------------------------------------------------
    # Post-processing: stack/queue operation detection
    # ------------------------------------------------------------------
    for name, curr_struct in curr_by_name.items():
        prev_struct = prev_by_name.get(name)
        if prev_struct is None:
            continue
        sq_actions = _detect_stack_queue_actions(prev_struct, curr_struct)
        if sq_actions:
            # Suppress the corresponding node_created/node_removed actions
            for sqa in sq_actions:
                addr = sqa.node_addr
                actions = [a for a in actions
                           if not (a.structure_name == sqa.structure_name and
                                   a.node_addr == addr and
                                   a.action in ("node_created", "node_removed"))]
            actions.extend(sq_actions)

    # ------------------------------------------------------------------
    # Post-processing: heap path swap detection
    # ------------------------------------------------------------------
    for name, curr_struct in curr_by_name.items():
        prev_struct = prev_by_name.get(name)
        if prev_struct is None:
            continue
        hp_actions = _detect_heap_path_swap(prev_struct, curr_struct)
        if hp_actions:
            actions.extend(hp_actions)

    return actions or [DiffAction(action="no_change", structure_name="")]


def _detect_sort_actions(
    prev_struct: dict,
    curr_struct: dict,
    watched_vars: list[str] | None,
) -> list[DiffAction]:
    """Detect sorting comparisons and swaps using watched pointer positions.

    Uses the pointers_pointing_here on each node to determine which
    elements are being watched at each step. If two watched pointers
    point to different nodes, those nodes are being compared.
    If the values at those nodes cross-matched, a swap occurred.

    This is more robust than the old cross-matching heuristic because:
    - It uses the user's explicit watch annotations as the signal
    - It detects comparisons even when pointers stay in place
    - It detects swaps by comparing current pointer positions, not
      just by inferring from value_changed cross-matches
    """
    if not watched_vars:
        return []

    actions: list[DiffAction] = []

    prev_nodes = {n["addr"]: n for n in prev_struct.get("nodes", [])}
    curr_nodes = {n["addr"]: n for n in curr_struct.get("nodes", [])}

    # Build pointer -> addr maps for current and previous snapshots
    prev_ptrs: dict[str, str] = {}
    for addr, n in prev_nodes.items():
        for ptr in n.get("pointers_pointing_here", []):
            if ptr in watched_vars:
                prev_ptrs[ptr] = addr

    curr_ptrs: dict[str, str] = {}
    for addr, n in curr_nodes.items():
        for ptr in n.get("pointers_pointing_here", []):
            if ptr in watched_vars:
                curr_ptrs[ptr] = addr

    # Find watched pointers that changed target address
    moved: list[tuple[str, str | None, str]] = []
    for ptr in watched_vars:
        prev_addr = prev_ptrs.get(ptr)
        curr_addr = curr_ptrs.get(ptr)
        if curr_addr and prev_addr != curr_addr:
            moved.append((ptr, prev_addr, curr_addr))

    structure_name = curr_struct.get("annotation_name", "")

    # ---- Comparison detection ----
    # When 2+ watched pointers are pointing to different nodes in a
    # sorting structure, those nodes are being compared.
    if len(moved) >= 2:
        nodes_involved = [m[2] for m in moved[:2] if m[2]]
        ptrs_involved = [m[0] for m in moved[:2]]
        if len(nodes_involved) >= 2:
            actions.append(DiffAction(
                action="element_compared",
                structure_name=structure_name,
                node_addr=",".join(nodes_involved),
                detail={"pointers": ptrs_involved, "phase": "compare"},
            ))

    # ---- Swap detection ----
    # A swap is detected when two nodes swap their "val" fields.
    # Use the cached value_changed cross-match approach as primary signal,
    # and also check watched pointer positions as secondary validation.
    #
    # First: collect value changes visible in the structure nodes.
    val_changes: list[tuple[str, str, str, str]] = []  # (addr, old_val, new_val, field_name)
    for addr in set(prev_nodes) & set(curr_nodes):
        pf = prev_nodes[addr].get("fields", {})
        cf = curr_nodes[addr].get("fields", {})
        for key in cf:
            if key in pf and str(pf[key]) != str(cf[key]):
                val_changes.append((addr, str(pf[key]), str(cf[key]), key))

    # Second: cross-match for swaps.
    for i in range(len(val_changes)):
        for j in range(i + 1, len(val_changes)):
            addr_i, old_i, new_i, key_i = val_changes[i]
            addr_j, old_j, new_j, key_j = val_changes[j]
            if key_i == key_j and old_i == new_j and old_j == new_i and old_i != new_i:
                actions.append(DiffAction(
                    action="element_swapped",
                    structure_name=structure_name,
                    node_addr=f"{addr_i},{addr_j}",
                    detail={
                        "node_a": addr_i,
                        "node_b": addr_j,
                        "val_a": new_i,
                        "val_b": new_j,
                        "phase": "swap",
                    },
                ))
                # Only report each pair once
                break

    # Third: also check if watched pointers themselves indicate a swap
    # (pointers swapped targets between two nodes)
    if len(moved) >= 2:
        for i in range(len(moved)):
            for j in range(i + 1, len(moved)):
                ptr_a, prev_a, curr_a = moved[i]
                ptr_b, prev_b, curr_b = moved[j]
                if prev_a == curr_b and prev_b == curr_a and prev_a and curr_a:
                    # Pointers crossed — likely a swap
                    # Check if we already captured this pair
                    already_found = any(
                        a.action == "element_swapped" and
                        (curr_a in a.node_addr.split(",") and curr_b in a.node_addr.split(","))
                        for a in actions
                    )
                    if not already_found:
                        actions.append(DiffAction(
                            action="element_swapped",
                            structure_name=structure_name,
                            node_addr=f"{curr_a},{curr_b}",
                            detail={
                                "node_a": curr_a,
                                "node_b": curr_b,
                                "ptrs_a": ptr_a,
                                "ptrs_b": ptr_b,
                                "phase": "swap",
                            },
                        ))

    return actions


def _detect_stack_queue_actions(
    prev_struct: dict,
    curr_struct: dict,
) -> list[DiffAction]:
    """Detect stack push/pop and queue enqueue/dequeue operations.

    Only applies to structures with structure_type in ("stack", "queue").
    Detects node count changes and assigns direction-specific actions.
    """
    structure_type = curr_struct.get("structure_type", "")
    if structure_type not in ("stack", "queue"):
        return []

    prev_nodes = prev_struct.get("nodes", [])
    curr_nodes = curr_struct.get("nodes", [])
    structure_name = curr_struct.get("annotation_name", "")

    prev_addrs = {n["addr"] for n in prev_nodes}
    curr_addrs = {n["addr"] for n in curr_nodes}

    actions: list[DiffAction] = []

    # New nodes: pushes/enqueues
    for addr in curr_addrs - prev_addrs:
        if structure_type == "stack":
            direction = "top"
            action = "node_pushed"
        else:
            direction = "rear"
            action = "node_pushed"
        actions.append(DiffAction(
            action=action,
            structure_name=structure_name,
            node_addr=addr,
            detail={"direction": direction},
        ))

    # Removed nodes: pops/dequeues
    for addr in prev_addrs - curr_addrs:
        if structure_type == "stack":
            direction = "top"
            action = "node_popped"
        else:
            direction = "front"
            action = "node_popped"
        actions.append(DiffAction(
            action=action,
            structure_name=structure_name,
            node_addr=addr,
            detail={"direction": direction},
        ))

    return actions

def _detect_heap_path_swap(
    prev_struct: dict,
    curr_struct: dict,
) -> list[DiffAction]:
    """Detect heap sift-up/sift-down path swap operations."""
    if curr_struct.get("structure_type", "") != "heap":
        return []

    prev_nodes = prev_struct.get("nodes", [])
    curr_nodes = curr_struct.get("nodes", [])

    prev_by_idx: dict[int, dict] = {}
    curr_by_idx: dict[int, dict] = {}
    for n in prev_nodes:
        idx_str = (n.get("fields", {}) or {}).get("index", "")
        if idx_str.isdigit():
            prev_by_idx[int(idx_str)] = n
    for n in curr_nodes:
        idx_str = (n.get("fields", {}) or {}).get("index", "")
        if idx_str.isdigit():
            curr_by_idx[int(idx_str)] = n

    changed_set: set[int] = set()
    for i in set(prev_by_idx) & set(curr_by_idx):
        pv = (prev_by_idx[i].get("fields", {}) or {}).get("val", "")
        cv = (curr_by_idx[i].get("fields", {}) or {}).get("val", "")
        if pv and cv and str(pv) != str(cv):
            changed_set.add(i)

    if len(changed_set) < 2:
        return []

    actions: list[DiffAction] = []
    visited: set[int] = set()

    for start_idx in changed_set:
        if start_idx in visited:
            continue
        path: list[int] = [start_idx]
        visited.add(start_idx)
        parent = (start_idx - 1) // 2
        while parent >= 0 and parent in changed_set and parent not in visited:
            path.insert(0, parent)
            visited.add(parent)
            parent = (parent - 1) // 2
        child = start_idx
        while True:
            left = 2 * child + 1
            right = 2 * child + 2
            found = False
            for c in (left, right):
                if c in changed_set and c not in visited:
                    path.append(c)
                    visited.add(c)
                    child = c
                    found = True
                    break
            if not found:
                break
        if len(path) >= 2:
            actions.append(DiffAction(
                action="node_path_swapped",
                structure_name=curr_struct.get("annotation_name", ""),
                node_addr=",".join(str(i) for i in path),
                detail={
                    "path_indices": path,
                    "direction": "up" if path[0] < path[-1] else "down",
                },
            ))

    return actions

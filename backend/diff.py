"""Snapshot diff engine — compares two StateSnapshot heap_structures
and produces a list of diff actions for the frontend to animate.

See DESIGN.md §6.3 for the full diff detection and animation mapping.
"""

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
    # Post-processing: swap detection
    # ------------------------------------------------------------------
    # A swap is two value_changed actions on the same structure where
    # A.old == B.new and B.old == A.new (values cross-matched).
    value_changes = [a for a in actions if a.action == "value_changed"]
    if len(value_changes) >= 2:
        # Group by structure
        vc_by_struct: dict[str, list[DiffAction]] = {}
        for vc in value_changes:
            vc_by_struct.setdefault(vc.structure_name, []).append(vc)

        for struct_name, vc_list in vc_by_struct.items():
            if len(vc_list) < 2:
                continue

            # Look for cross-matched pairs
            removed: set[int] = set()
            for i in range(len(vc_list)):
                for j in range(i + 1, len(vc_list)):
                    if i in removed or j in removed:
                        continue
                    a1, a2 = vc_list[i], vc_list[j]
                    ch1 = a1.detail.get("changed_fields", {})
                    ch2 = a2.detail.get("changed_fields", {})
                    val1 = ch1.get("val", {})
                    val2 = ch2.get("val", {})
                    if val1 and val2:
                        old1 = str(val1.get("old", ""))
                        new1 = str(val1.get("new", ""))
                        old2 = str(val2.get("old", ""))
                        new2 = str(val2.get("new", ""))
                        if old1 == new2 and old2 == new1 and old1 != new1:
                            # It's a swap — replace two value_changed with one swap
                            removed.add(i)
                            removed.add(j)
                            actions.append(DiffAction(
                                action="element_swapped",
                                structure_name=struct_name,
                                node_addr=f"{a1.node_addr},{a2.node_addr}",
                                detail={
                                    "node_a": a1.node_addr,
                                    "node_b": a2.node_addr,
                                    "val_a": new1,
                                    "val_b": new2,
                                },
                            ))

            # Remove the individual value_changed actions that were merged
            if removed:
                actions = [
                    a for idx, a in enumerate(actions)
                    if a.action != "value_changed" or
                       (a not in [vc_list[i] for i in removed])
                ]

    # ------------------------------------------------------------------
    # Post-processing: comparison detection
    # ------------------------------------------------------------------
    # A comparison is detected when two or more watched pointers move
    # to different nodes in the same structure within a single step.
    if watched_vars:
        pointer_moves = [a for a in actions if a.action == "pointer_relocated"
                         and a.detail.get("pointer", "") in watched_vars]
        pm_by_struct: dict[str, list[DiffAction]] = {}
        for pm in pointer_moves:
            pm_by_struct.setdefault(pm.structure_name, []).append(pm)

        for struct_name, moves in pm_by_struct.items():
            if len(moves) >= 2:
                nodes = [m.node_addr for m in moves if m.node_addr]
                pointers = [m.detail.get("pointer", "") for m in moves]
                if len(nodes) >= 2:
                    actions.append(DiffAction(
                        action="element_compared",
                        structure_name=struct_name,
                        node_addr=",".join(nodes[:2]),
                        detail={"pointers": pointers[:2]},
                    ))

    return actions or [DiffAction(action="no_change", structure_name="")]

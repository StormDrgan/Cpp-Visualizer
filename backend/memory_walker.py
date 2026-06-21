"""Memory Walker — traverses heap data structures via the LLDB bridge.

For v0.2: only linked list walking is implemented.
v0.3+ will add binary_tree, array, graph traversal.

The MemoryWalker doesn't talk to LLDB directly — it receives a callback
(send_cmd) that sends commands to the LLDB bridge and returns responses.
This keeps it bridge-agnostic.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class HeapNode:
    """A single heap-allocated node in a data structure."""
    addr: str
    label: str
    fields: dict = field(default_factory=dict)
    pointers_pointing_here: list[str] = field(default_factory=list)


def _is_null_addr(addr: str) -> bool:
    """Check if an address string represents null or is empty/unset.

    Handles: "", "0x0", "0x0000000000000000", "0x00000000", etc.
    At the first line of main(), uninitialized pointers may report as
    0x0 or empty string from LLDB's GetVariables.
    """
    if not addr or not addr.strip():
        return True
    try:
        return int(addr.strip(), 16) == 0
    except ValueError:
        return False  # non-hex string — likely an error, not null


@dataclass
class TreeEdge:
    """A parent-child edge in a tree structure."""
    from_idx: int
    to_idx: int
    child_side: str = ""  # "left" or "right"


@dataclass
class TraversalResult:
    """Result of walking a data structure."""
    annotation_name: str
    structure_type: str
    root_node_addr: str
    nodes: list[HeapNode] = field(default_factory=list)
    edges: list[TreeEdge] = field(default_factory=list)
    cycle_detected: bool = False


class MemoryWalker:
    """Walks heap data structures by issuing commands to the LLDB bridge.

    Args:
        send_cmd: A callable that takes a dict command and returns a dict response.
                  This is the LLDBController._send_cmd or similar.
    """

    def __init__(self, send_cmd: Callable[[dict], dict]):
        self._send = send_cmd

    def walk_linked_list(
        self,
        annotation_name: str,
        root_var: str,
        next_field: str,
        watched_vars: list[str] | None = None,
    ) -> TraversalResult:
        """Walk a linked list from root_var following next_field.

        Args:
            annotation_name: User-given name (e.g., "list1").
            root_var: C++ variable name of the head pointer.
            next_field: Name of the struct field that points to the next node.
            watched_vars: Optional list of pointer variable names to match.

        Returns:
            TraversalResult with all nodes and pointer assignments.
        """
        if watched_vars is None:
            watched_vars = []

        # Walk via the bridge — bridge evaluates root_var to get both value and type
        resp = self._send({
            "cmd": "walk_linked_list",
            "root_var": root_var,
            "next_field": next_field,
        })

        if not resp.get("ok"):
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="linked_list",
                root_node_addr="0x0",
            )

        result = resp.get("result", {})
        raw_nodes = result.get("nodes", [])
        cycle = result.get("cycle_detected", False)
        root_addr = raw_nodes[0]["addr"] if raw_nodes else "0x0"

        # Step 3: build HeapNode list
        nodes = []
        for n in raw_nodes:
            nodes.append(HeapNode(
                addr=n.get("addr", "0x0"),
                label=n.get("label", ""),
                fields=n.get("fields", {}),
            ))

        # Step 4: match watched pointers to nodes
        if watched_vars and nodes:
            self._match_pointers(nodes, watched_vars)

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="linked_list",
            root_node_addr=root_addr,
            nodes=nodes,
            cycle_detected=cycle,
        )

    def walk_binary_tree(
        self,
        annotation_name: str,
        root_var: str,
        left_field: str = "left",
        right_field: str = "right",
        watched_vars: list[str] | None = None,
    ) -> TraversalResult:
        """Walk a binary tree from root_var following left_field and right_field.

        Uses BFS (level-order) to collect all nodes and parent-child edges.
        """
        if watched_vars is None:
            watched_vars = []

        resp = self._send({
            "cmd": "walk_binary_tree",
            "root_var": root_var,
            "left_field": left_field,
            "right_field": right_field,
        })

        if not resp.get("ok"):
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="binary_tree",
                root_node_addr="0x0",
            )

        result = resp.get("result", {})
        raw_nodes = result.get("nodes", [])
        raw_edges = result.get("edges", [])
        root_addr = raw_nodes[0]["addr"] if raw_nodes else "0x0"

        # Build HeapNode list
        nodes = []
        for n in raw_nodes:
            nodes.append(HeapNode(
                addr=n.get("addr", "0x0"),
                label=n.get("label", ""),
                fields=n.get("fields", {}),
            ))

        # Build TreeEdge list
        edges = []
        for e in raw_edges:
            edges.append(TreeEdge(
                from_idx=e.get("from_idx", -1),
                to_idx=e.get("to_idx", -1),
                child_side="",  # resolved below from field values
            ))

        # Determine child_side for each edge by checking parent's left/right fields
        for edge in edges:
            if edge.from_idx < len(nodes):
                parent = nodes[edge.from_idx]
                child_addr = nodes[edge.to_idx].addr if edge.to_idx < len(nodes) else ""
                if parent.fields.get(left_field) == child_addr:
                    edge.child_side = "left"
                elif parent.fields.get(right_field) == child_addr:
                    edge.child_side = "right"

        # Match watched pointers to nodes
        if watched_vars and nodes:
            self._match_pointers(nodes, watched_vars)

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="binary_tree",
            root_node_addr=root_addr,
            nodes=nodes,
            edges=edges,
        )

    def walk_array(
        self,
        annotation_name: str,
        root_var: str,
        length_var: str = "",
        watched_vars: list[str] | None = None,
    ) -> TraversalResult:
        """Walk a C++ array from root_var, reading length_var elements.

        Args:
            annotation_name: User-given name (e.g., "A").
            root_var: C++ variable name of the array.
            length_var: Variable name or literal integer for the element count.
            watched_vars: Optional list of pointer variable names to match.

        Returns:
            TraversalResult with nodes for each array element.
        """
        if watched_vars is None:
            watched_vars = []

        resp = self._send({
            "cmd": "walk_array",
            "var_name": root_var,
            "length_var": length_var,
        })

        if not resp.get("ok"):
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="array",
                root_node_addr="0x0",
            )

        result = resp.get("result", {})
        raw_nodes = result.get("nodes", [])
        root_addr = raw_nodes[0]["addr"] if raw_nodes else "0x0"

        nodes = []
        for n in raw_nodes:
            nodes.append(HeapNode(
                addr=n.get("addr", "0x0"),
                label=n.get("label", ""),
                fields=n.get("fields", {}),
            ))

        # Match watched pointers to array element addresses
        if watched_vars and nodes:
            self._match_pointers(nodes, watched_vars)

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="array",
            root_node_addr=root_addr,
            nodes=nodes,
        )

    def walk_graph(
        self,
        annotation_name: str,
        root_var: str,
        mode: str = "adjlist",
        size_var: str = "",
        watched_vars: list[str] | None = None,
    ) -> TraversalResult:
        """Walk a graph structure (adjacency matrix or adjacency list).

        Args:
            annotation_name: User-given name (e.g., "G").
            root_var: C++ variable name of the graph data structure.
            mode: "matrix" for adjacency matrix, "adjlist" for adjacency list.
            size_var: Variable name for vertex count.
            watched_vars: Optional list of pointer variable names to match.
        """
        if watched_vars is None:
            watched_vars = []

        resp = self._send({
            "cmd": "walk_graph",
            "root_var": root_var,
            "mode": mode,
            "size_var": size_var,
        })

        if not resp.get("ok"):
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="graph",
                root_node_addr="0x0",
            )

        result = resp.get("result", {})
        raw_nodes = result.get("nodes", [])
        raw_edges = result.get("edges", [])
        root_addr = raw_nodes[0]["addr"] if raw_nodes else "0x0"

        nodes = [HeapNode(
            addr=n.get("addr", "0x0"),
            label=n.get("label", ""),
            fields=n.get("fields", {}),
        ) for n in raw_nodes]

        edges = [TreeEdge(
            from_idx=e.get("from_idx", -1),
            to_idx=e.get("to_idx", -1),
            child_side="",
        ) for e in raw_edges]

        if watched_vars and nodes:
            self._match_pointers(nodes, watched_vars)

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="graph",
            root_node_addr=root_addr,
            nodes=nodes,
            edges=edges,
        )

    def walk_hashmap(
        self,
        annotation_name: str,
        root_var: str,
        mode: str = "chaining",
        watched_vars: list[str] | None = None,
    ) -> TraversalResult:
        """Walk a hash table structure.

        Args:
            annotation_name: User-given name (e.g., "H").
            root_var: C++ variable name of the hash table.
            mode: "chaining" for separate chaining, "open_addressing" for open addressing.
            watched_vars: Optional list of pointer variable names to match.
        """
        if watched_vars is None:
            watched_vars = []

        resp = self._send({
            "cmd": "walk_hashmap",
            "root_var": root_var,
            "mode": mode,
        })

        if not resp.get("ok"):
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="hashmap",
                root_node_addr="0x0",
            )

        result = resp.get("result", {})
        raw_nodes = result.get("nodes", [])
        raw_edges = result.get("edges", [])
        root_addr = raw_nodes[0]["addr"] if raw_nodes else "0x0"

        nodes = [HeapNode(
            addr=n.get("addr", "0x0"),
            label=n.get("label", ""),
            fields=n.get("fields", {}),
        ) for n in raw_nodes]

        edges = [TreeEdge(
            from_idx=e.get("from_idx", -1),
            to_idx=e.get("to_idx", -1),
            child_side="",
        ) for e in raw_edges]

        if watched_vars and nodes:
            self._match_pointers(nodes, watched_vars)

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="hashmap",
            root_node_addr=root_addr,
            nodes=nodes,
            edges=edges,
        )

    def _match_pointers(self, nodes: list[HeapNode], watched_vars: list[str]) -> None:
        """For each watched variable, find which node it points to.

        Two-phase matching:
        1. Address match: evaluate the variable, treat result as hex address,
           match against node.addr (works for pointer variables like slow, fast).
        2. Index match: for array structures, if no address match found,
           try matching the evaluated value against node.fields["index"]
           (works for integer loop counters like i, j, lo, hi, mid).
        """
        for var in watched_vars:
            resp = self._send({"cmd": "evaluate", "expression": var})
            if not resp.get("ok"):
                continue
            value = resp.get("result", {}).get("value", "")
            if not value:
                continue
            # Null pointers: skip genuinely null pointer values, but NOT the
            # decimal string "0" — that is a valid array index (lo=0, i=0).
            if value in ("0x0", "0x0000000000000000", "nullptr", "NULL"):
                continue
            # Also skip "0" only when it's clearly a hex pointer address
            # (uninitialized pointers may appear as "0x0" variations).
            if value.startswith("0x") and _is_null_addr(value):
                continue

            # Phase 1: address match (for pointer variables)
            matched = False
            for node in nodes:
                if node.addr == value:
                    node.pointers_pointing_here.append(var)
                    matched = True
                    break

            if matched:
                continue

            # Phase 2: index match (for array index variables like i, j, lo, hi)
            # Guard: only attempt index match if the value looks like an integer
            # (not a hex address), to avoid matching uninitialized pointer garbage.
            try:
                int(value)
            except ValueError:
                continue  # value is not an integer (likely a pointer address)
            for node in nodes:
                node_index = node.fields.get("index", "")
                if node_index == value:
                    node.pointers_pointing_here.append(var)
                    break

    def auto_discover(self, variables: list) -> list:
        """Auto-detect data structures from local variable types.

        **Per-variable strategy (v2):** Each pointer variable gets its own
        annotation.  Post-walk deduplication in snapshot.py merges variables
        that point to the exact same chain/tree, so e.g. slow/fast produce one
        structure with two pointer labels, while prev/curr during reversal
        produce two independent structures.

        For each pointer variable: inspect its deref_type, look for fields
        that point to the same struct type, and classify as linked_list
        or binary_tree based on field count and naming heuristics.
        For array variables: detect fixed-size arrays from type strings.

        Args:
            variables: List of objects with .name, .type, .is_pointer, .deref_type
                       (typically Variable dataclass instances from debugger.py).

        Returns:
            List of Annotation objects.
        """
        import re
        from annotations import Annotation

        annotations: list[Annotation] = []
        # Cache inspect_type results per struct_type to avoid redundant calls
        _type_cache: dict[str, dict] = {}
        # Track which variable names are already roots (to build auto-watch)
        root_names: set[str] = set()
        discovered_types: set[str] = set()

        for var in variables:
            if not getattr(var, 'is_pointer', False) or not getattr(var, 'deref_type', ''):
                continue

            var_name = getattr(var, 'name', '')
            struct_type = getattr(var, 'deref_type', '')

            # Skip null or uninitialized pointers — at the first line of main(),
            # pointer variables are in scope but their values haven't been set
            # yet (garbage or 0x0).  Walking from a garbage address produces
            # phantom nodes on the canvas.
            raw_value = getattr(var, 'value', '').strip()
            if _is_null_addr(raw_value):
                continue

            # Use cached type inspection
            if struct_type not in _type_cache:
                resp = self._send({"cmd": "inspect_type", "type_name": struct_type})
                if resp.get("ok"):
                    _type_cache[struct_type] = resp.get("result", {}).get("fields", [])
                else:
                    _type_cache[struct_type] = []  # negative cache

            fields = _type_cache[struct_type]
            same_type_fields = [f for f in fields
                                if f.get("is_pointer") and f.get("points_to_same_type")]

            if len(same_type_fields) == 2:
                names = [f["name"] for f in same_type_fields]

                # v0.9: Distinguish doubly-linked list from binary tree.
                # If one field looks like "prev" and the other like "next",
                # classify as linked_list (doubly), not binary_tree.
                PREV_PATTERNS = {"prev", "previous", "pre", "last", "backward", "back"}
                NEXT_PATTERNS = {"next", "succ", "nxt", "link", "forward", "front"}
                prev_fields = [f for f in same_type_fields if f["name"] in PREV_PATTERNS]
                next_fields = [f for f in same_type_fields if f["name"] in NEXT_PATTERNS]
                left_fields = [f for f in same_type_fields if "left" in f["name"]]
                right_fields = [f for f in same_type_fields if "right" in f["name"]]

                if prev_fields and next_fields:
                    # Doubly linked list
                    prev_field = prev_fields[0]["name"]
                    next_field = next_fields[0]["name"]
                    annotations.append(Annotation(
                        struct_type="linked_list",
                        name=f"auto_{var_name}",
                        root_var=var_name,
                        next_field=next_field,
                        prev_field=prev_field,
                    ))
                    root_names.add(var_name)
                    discovered_types.add(struct_type)
                elif left_fields or right_fields:
                    # Binary tree — prefer left/right naming
                    left = (left_fields[0]["name"] if left_fields
                            else same_type_fields[0]["name"])
                    right = (right_fields[0]["name"] if right_fields
                             else same_type_fields[1]["name"])

                    # v0.9: Check for AVL tree by looking for height/bf fields
                    avl_fields = [f for f in fields
                                  if not f.get("is_pointer")
                                  and f.get("name") in ("height", "bf", "balance_factor", "balance")]
                    tree_variant = "avl" if avl_fields else ""

                    annotations.append(Annotation(
                        struct_type="binary_tree",
                        name=f"auto_{var_name}",
                        root_var=var_name,
                        left_field=left,
                        right_field=right,
                        tree_variant=tree_variant,
                    ))
                    root_names.add(var_name)
                    discovered_types.add(struct_type)
                else:
                    # Ambiguous: 2 same-type pointer fields, no left/right naming,
                    # no prev/next naming.  Default to binary_tree with ordered fields.
                    left, right = same_type_fields[0]["name"], same_type_fields[1]["name"]
                    annotations.append(Annotation(
                        struct_type="binary_tree",
                        name=f"auto_{var_name}",
                        root_var=var_name,
                        left_field=left,
                        right_field=right,
                    ))
                    root_names.add(var_name)
                    discovered_types.add(struct_type)

            elif len(same_type_fields) == 1:
                # Linked list candidate — every pointer becomes its own root
                next_name = same_type_fields[0]["name"]
                annotations.append(Annotation(
                    struct_type="linked_list",
                    name=f"auto_{var_name}",
                    root_var=var_name,
                    next_field=next_name,
                ))
                root_names.add(var_name)
                discovered_types.add(struct_type)

        # Array detection from non-pointer type strings like "int [8]"
        for var in variables:
            type_str = getattr(var, 'type', '')
            m = re.match(r'(.+?)\s*\[(\d+)\]', type_str)
            if m:
                annotations.append(Annotation(
                    struct_type="array",
                    name=f"auto_{var_name}",
                    root_var=getattr(var, 'name', ''),
                    length_var=m.group(2),
                ))

        # Auto-watch: collect pointer variables of discovered types that
        # weren't promoted to roots (e.g. when inspect_type failed for them).
        watched: list[str] = []
        for var in variables:
            vname = getattr(var, 'name', '')
            if vname in root_names:
                continue
            if getattr(var, 'is_pointer', False) and getattr(var, 'deref_type', ''):
                dt = getattr(var, 'deref_type', '')
                if dt in discovered_types:
                    watched.append(vname)

        if watched:
            annotations.append(Annotation(
                struct_type="watch", name="", watched_vars=watched,
            ))

        return annotations

    def walk_recursion(
        self,
        annotation_name: str,
        call_stack: list,
        prev_call_stack: list | None = None,
    ) -> TraversalResult:
        """Build a recursion tree from the current call stack.

        Each stack frame becomes a tree node. The outermost caller (main)
        is the root; nested calls are children of their caller.

        This does NOT require LLDB — it operates on the already-available
        call_stack data from DebuggerState.

        Args:
            annotation_name: User-given name for the recursion tree.
            call_stack: List of StackFrame objects (from DebuggerState).
            prev_call_stack: Previous call stack for detecting new/returned calls.

        Returns:
            TraversalResult with nodes (one per stack frame) and edges
            (parent-child relationships).
        """
        nodes: list[HeapNode] = []
        edges: list[TreeEdge] = []
        root_addr = "0x0"

        if not call_stack:
            return TraversalResult(
                annotation_name=annotation_name,
                structure_type="recursion_tree",
                root_node_addr=root_addr,
                nodes=nodes,
                edges=edges,
            )

        # Build node ids and track parent relationships.
        # call_stack[0] is the deepest frame (current function).
        # call_stack[-1] is the outermost (main).
        # We build the tree from root (main) down to leaves (deepest calls).
        prev_ids: set[str] = set()
        if prev_call_stack:
            for frame in prev_call_stack:
                func = getattr(frame, 'function', '')
                line = getattr(frame, 'line', 0)
                fid = f"{func}:{line}"
                prev_ids.add(fid)

        for i, frame in enumerate(reversed(call_stack)):
            func = getattr(frame, 'function', 'unknown')
            line = getattr(frame, 'line', 0)
            fid = f"{func}:{line}"
            depth = i
            parent_id = None if i == 0 else nodes[i - 1].addr
            status = "active"
            if prev_call_stack and fid in prev_ids:
                status = "active"  # still in the stack
            addr = fid

            if i == 0:
                root_addr = addr

            nodes.append(HeapNode(
                addr=addr,
                label=func,
                fields={
                    "function": func,
                    "line": str(line),
                    "depth": str(depth),
                    "status": status,
                },
            ))

            if parent_id is not None:
                edges.append(TreeEdge(
                    from_idx=i - 1,  # parent
                    to_idx=i,       # child
                ))

        # Mark returned frames (in prev but not in current)
        curr_ids = {n.addr for n in nodes}
        for n in nodes:
            if n.addr not in curr_ids:
                n.fields["status"] = "returned"

        return TraversalResult(
            annotation_name=annotation_name,
            structure_type="recursion_tree",
            root_node_addr=root_addr,
            nodes=nodes,
            edges=edges,
        )

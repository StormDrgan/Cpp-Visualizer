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
            value = resp.get("result", {}).get("value", "0x0")
            if not value or value in ("0x0", "0", "nullptr", "NULL"):
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
                # Binary tree candidate — prefer left/right naming
                names = [f["name"] for f in same_type_fields]
                if "left" in names or "right" in names:
                    left = next((f["name"] for f in same_type_fields
                                 if "left" in f["name"]), same_type_fields[0]["name"])
                    right = next((f["name"] for f in same_type_fields
                                  if "right" in f["name"]), same_type_fields[1]["name"])
                else:
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

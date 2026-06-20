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

    def _match_pointers(self, nodes: list[HeapNode], watched_vars: list[str]) -> None:
        """For each watched variable, find which node it points to."""
        for var in watched_vars:
            resp = self._send({"cmd": "evaluate", "expression": var})
            if not resp.get("ok"):
                continue
            addr = resp.get("result", {}).get("value", "0x0")
            if addr and addr not in ("0x0", "0", "nullptr", "NULL"):
                for node in nodes:
                    if node.addr == addr:
                        node.pointers_pointing_here.append(var)
                        break

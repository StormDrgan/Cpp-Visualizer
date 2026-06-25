"""Tests for backend/snapshot.py — snapshot building and helper functions."""

from __future__ import annotations

from unittest.mock import MagicMock, PropertyMock
import pytest

from snapshot import (
    _traversal_to_dict,
    _dedup_structures,
    _collect_labels,
    _build_candidates,
    _compute_graph_traversal_colors,
    _build_heap_structures,
    build_snapshot,
)
from memory_walker import TraversalResult, HeapNode, TreeEdge, MemoryWalker
from annotations import Annotation


# ── Helpers ────────────────────────────────────────────────────────────

def _hnode(addr: str, label: str = "", fields: dict | None = None,
           pointers: list[str] | None = None) -> HeapNode:
    return HeapNode(addr, label or f"Node({addr})", fields or {}, pointers or [])


def _trav_result(name: str = "test", stype: str = "linked_list",
                 root: str = "0x1", nodes: list[HeapNode] | None = None,
                 edges: list[TreeEdge] | None = None) -> TraversalResult:
    return TraversalResult(name, stype, root, nodes or [], edges or [])


def _make_mock_walker(**returns) -> MemoryWalker:
    """Create a MemoryWalker mock with controlled return values for walk_* methods."""
    walker = MagicMock()
    for method_name, return_value in returns.items():
        getattr(walker, method_name).return_value = return_value
    return walker


# ── _traversal_to_dict ────────────────────────────────────────────────

class TestTraversalToDict:
    def test_empty_result(self):
        result = _trav_result()
        d = _traversal_to_dict(result)
        assert d["annotation_name"] == "test"
        assert d["structure_type"] == "linked_list"
        assert d["nodes"] == []
        assert d["edges"] == []

    def test_result_with_nodes(self):
        result = _trav_result(nodes=[
            _hnode("0x1", "Node(5)", {"val": "5"}),
            _hnode("0x2", "Node(3)", {"val": "3"}, pointers=["head"]),
        ])
        d = _traversal_to_dict(result)
        assert len(d["nodes"]) == 2
        assert d["nodes"][0]["addr"] == "0x1"
        assert d["nodes"][0]["fields"] == {"val": "5"}
        assert d["nodes"][1]["pointers_pointing_here"] == ["head"]

    def test_result_with_edges(self):
        result = _trav_result(edges=[
            TreeEdge(0, 1, "left"),
            TreeEdge(0, 2, "right"),
        ])
        d = _traversal_to_dict(result)
        assert len(d["edges"]) == 2
        assert d["edges"][0]["from_idx"] == 0
        assert d["edges"][0]["child_side"] == "left"

    def test_cycle_detected_preserved(self):
        result = _trav_result()
        result.cycle_detected = True
        d = _traversal_to_dict(result)
        assert d["cycle_detected"] is True


# ── _dedup_structures ──────────────────────────────────────────────────

class TestDedupStructures:
    def test_empty_list(self):
        assert _dedup_structures([]) == []

    def test_single_structure_with_nodes(self):
        s = {"annotation_name": "list", "structure_type": "linked_list",
             "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}], "edges": []}
        result = _dedup_structures([s])
        assert len(result) == 1

    def test_empty_nodes_filtered_out(self):
        s = {"annotation_name": "list", "structure_type": "linked_list",
             "root_node_addr": "0x0", "nodes": [], "edges": []}
        assert _dedup_structures([s]) == []

    def test_identical_sets_merged(self):
        s1 = {"annotation_name": "list1", "structure_type": "linked_list",
              "root_node_addr": "0x1", "nodes": [{"addr": "0x1", "pointers_pointing_here": []}]}
        s2 = {"annotation_name": "list2", "structure_type": "linked_list",
              "root_node_addr": "0x1", "nodes": [{"addr": "0x1", "pointers_pointing_here": []}]}
        result = _dedup_structures([s1, s2])
        assert len(result) == 1
        # The merged structure should have pointer labels from both
        ptrs = result[0]["nodes"][0].get("pointers_pointing_here", [])
        assert "list1" in ptrs
        assert "list2" in ptrs

    def test_subset_merged_into_superset(self):
        s1 = {"annotation_name": "big", "structure_type": "linked_list",
              "root_node_addr": "0x1",
              "nodes": [{"addr": "0x1", "pointers_pointing_here": []},
                        {"addr": "0x2", "pointers_pointing_here": []}]}
        s2 = {"annotation_name": "small", "structure_type": "linked_list",
              "root_node_addr": "0x1",
              "nodes": [{"addr": "0x1", "pointers_pointing_here": []}]}
        result = _dedup_structures([s1, s2])
        assert len(result) == 1
        assert len(result[0]["nodes"]) == 2  # superset kept

    def test_disjoint_structures_kept_separate(self):
        s1 = {"annotation_name": "list1", "structure_type": "linked_list",
              "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        s2 = {"annotation_name": "list2", "structure_type": "linked_list",
              "root_node_addr": "0x2", "nodes": [{"addr": "0x2"}]}
        result = _dedup_structures([s1, s2])
        assert len(result) == 2

    def test_non_dedup_types_passthrough(self):
        """Array, stack, queue, graph, hashmap skip dedup."""
        s = {"annotation_name": "arr", "structure_type": "array",
             "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        result = _dedup_structures([s, s])
        assert len(result) == 2  # both kept, not deduplicated


# ── _collect_labels ────────────────────────────────────────────────────

class TestCollectLabels:
    def test_collects_root_var(self):
        s = {"annotation_name": "mylist", "root_node_addr": "0x1",
             "nodes": []}
        labels: dict[str, list[str]] = {}
        _collect_labels(s, labels)
        assert "mylist" in labels.get("0x1", [])

    def test_strips_auto_prefix(self):
        s = {"annotation_name": "auto_list", "root_node_addr": "0x1",
             "nodes": []}
        labels: dict[str, list[str]] = {}
        _collect_labels(s, labels)
        assert "list" in labels.get("0x1", [])

    def test_collects_node_pointers(self):
        s = {"annotation_name": "foo", "root_node_addr": "0x1",
             "nodes": [{"addr": "0x2", "pointers_pointing_here": ["slow", "fast"]}]}
        labels: dict[str, list[str]] = {}
        _collect_labels(s, labels)
        assert "slow" in labels.get("0x2", [])
        assert "fast" in labels.get("0x2", [])

    def test_ignores_null_root(self):
        s = {"annotation_name": "foo", "root_node_addr": "0x0", "nodes": []}
        labels: dict[str, list[str]] = {}
        _collect_labels(s, labels)
        assert "0x0" not in labels


# ── _build_candidates ──────────────────────────────────────────────────

class TestBuildCandidates:
    def test_empty(self):
        assert _build_candidates([]) == []

    def test_single_structure(self):
        s = {"annotation_name": "list", "structure_type": "linked_list",
             "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        result = _build_candidates([s])
        assert len(result) == 1
        assert result[0]["var_name"] == "list"
        assert result[0]["struct_type"] == "linked_list"
        assert result[0]["node_count"] == 1

    def test_strips_auto_prefix(self):
        s = {"annotation_name": "auto_arr", "structure_type": "array",
             "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        result = _build_candidates([s])
        assert result[0]["var_name"] == "arr"

    def test_harvest_pointer_labels_from_nodes(self):
        s = {"annotation_name": "main_list", "structure_type": "linked_list",
             "root_node_addr": "0x1",
             "nodes": [{"addr": "0x1", "pointers_pointing_here": ["head", "curr"]}]}
        result = _build_candidates([s])
        var_names = {c["var_name"] for c in result}
        assert "head" in var_names
        assert "curr" in var_names

    def test_deduplicates_vars(self):
        s1 = {"annotation_name": "list", "structure_type": "linked_list",
              "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        s2 = {"annotation_name": "list", "structure_type": "linked_list",
              "root_node_addr": "0x1", "nodes": [{"addr": "0x1"}]}
        result = _build_candidates([s1, s2])
        # "list" appears only once despite two structures
        names = [c["var_name"] for c in result]
        assert names.count("list") == 1


# ── _compute_graph_traversal_colors ────────────────────────────────────

class TestComputeGraphTraversalColors:
    def test_no_show_vars_no_change(self):
        sdict: dict = {}
        result = _trav_result(nodes=[_hnode("0x1", pointers=["i"])])
        _compute_graph_traversal_colors(sdict, result, [])
        assert "traversal_state" not in sdict

    def test_less_than_two_visited_no_colors(self):
        result = _trav_result(nodes=[_hnode("0x1", pointers=["i"])])
        sdict: dict = {}
        _compute_graph_traversal_colors(sdict, result, ["i"])
        assert "traversal_state" not in sdict

    def test_two_visited_colors_applied(self):
        result = _trav_result(nodes=[
            _hnode("0x1", pointers=["i"]),
            _hnode("0x2", pointers=["j"]),
        ])
        sdict: dict = {}
        _compute_graph_traversal_colors(sdict, result, ["i", "j"])
        assert "traversal_state" in sdict
        assert len(sdict["traversal_state"]) == 2
        # Colors should be hex strings
        for color in sdict["traversal_state"].values():
            assert color.startswith("#")
            assert len(color) == 7

    def test_colors_change_with_order(self):
        """First visited and last visited should have different colors."""
        nodes = []
        for i in range(4):
            nodes.append(_hnode(f"0x{i}", pointers=[f"p{i}"]))
        result = _trav_result(nodes=nodes)
        sdict: dict = {}
        _compute_graph_traversal_colors(sdict, result, [f"p{i}" for i in range(4)])
        colors = list(sdict["traversal_state"].values())
        # First and last should differ (gradient)
        assert colors[0] != colors[-1]


# ── _build_heap_structures (with mocked walker) ────────────────────────

class TestBuildHeapStructures:
    def test_no_walker_returns_empty(self):
        assert _build_heap_structures([], None) == []

    def test_linked_list_annotation(self):
        ann = Annotation("linked_list", "list", root_var="head", next_field="next")
        result = _trav_result("list", "linked_list", "0x1",
                              nodes=[_hnode("0x1", "Node(5)", {"val": "5"})])
        walker = _make_mock_walker(walk_linked_list=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "linked_list"
        assert structures[0]["nodes"][0]["fields"]["val"] == "5"

    def test_binary_tree_annotation(self):
        ann = Annotation("binary_tree", "t", root_var="root",
                         left_field="left", right_field="right")
        result = _trav_result("t", "binary_tree", "0x1",
                              nodes=[_hnode("0x1", "Root(10)", {"val": "10"})])
        walker = _make_mock_walker(walk_binary_tree=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "binary_tree"

    def test_array_annotation(self):
        ann = Annotation("array", "arr", root_var="arr", length_var="n")
        result = _trav_result("arr", "array", "0x1",
                              nodes=[_hnode("0x1", "arr[0]", {"val": "1"})])
        walker = _make_mock_walker(walk_array=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "array"

    def test_stack_sequential(self):
        ann = Annotation("stack", "s", root_var="data", top_var="top")
        result = _trav_result("s", "array", "0x1",
                              nodes=[_hnode("0x1", "data[0]", {"val": "1"})])
        walker = _make_mock_walker(walk_array=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "stack"  # overridden

    def test_stack_linked(self):
        ann = Annotation("stack", "s", root_var="top", next_field="next")
        result = _trav_result("s", "linked_list", "0x1",
                              nodes=[_hnode("0x1", "Node(1)", {"val": "1"})])
        walker = _make_mock_walker(walk_linked_list=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "stack"

    def test_queue_circular(self):
        ann = Annotation("queue", "q", root_var="data",
                         front_var="front", rear_var="rear")
        result = _trav_result("q", "array", "0x1",
                              nodes=[_hnode("0x1", "q[0]", {"val": "1"})])
        walker = _make_mock_walker(walk_array=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "queue"

    def test_queue_linked(self):
        ann = Annotation("queue", "q", root_var="front", next_field="next")
        result = _trav_result("q", "linked_list", "0x1",
                              nodes=[_hnode("0x1", "Node(1)", {"val": "1"})])
        walker = _make_mock_walker(walk_linked_list=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "queue"

    def test_heap_annotation(self):
        ann = Annotation("heap", "h", root_var="data", length_var="size")
        result = _trav_result("h", "array", "0x1",
                              nodes=[_hnode("0x1", "data[0]", {"val": "5"})])
        walker = _make_mock_walker(walk_array=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["structure_type"] == "heap"

    def test_hashmap_annotation(self):
        ann = Annotation("hashmap", "hm", root_var="table", mode="chaining")
        result = _trav_result("hm", "hashmap", "0x1",
                              nodes=[_hnode("0x1", "bucket[0]", {"key": "1"})])
        walker = _make_mock_walker(walk_hashmap=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1

    def test_graph_annotation(self):
        ann = Annotation("graph", "g", root_var="adj", mode="adjlist")
        result = _trav_result("g", "graph", "0x1",
                              nodes=[_hnode("0x1", "V0", pointers=["cur"])])
        walker = _make_mock_walker(walk_graph=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1

    def test_b_tree_annotation(self):
        ann = Annotation("b_tree", "bt", root_var="root", length_var="5")
        result = _trav_result("bt", "b_tree", "0x1",
                              nodes=[_hnode("0x1", "Keys", {"_keys": "10|20"})])
        walker = _make_mock_walker(walk_b_tree=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["order"] == 5

    def test_bplustree_annotation(self):
        ann = Annotation("bplustree", "bp", root_var="root", length_var="6")
        result = _trav_result("bp", "bplustree", "0x1",
                              nodes=[_hnode("0x1", "Keys", {"_keys": "10|20|30"})])
        walker = _make_mock_walker(walk_b_tree=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 1
        assert structures[0]["order"] == 6

    def test_auto_discovery_triggered_without_struct_annotations(self):
        """When no struct annotations exist and step > 1, auto_discover is called."""
        # Only show annotations (no struct types)
        ann = Annotation("show", "", show_vars=["i", "j"])
        discovered = [
            Annotation("linked_list", "auto_head", root_var="head", next_field="next"),
        ]
        result = _trav_result("auto_head", "linked_list", "0x1",
                              nodes=[_hnode("0x1", "Node(5)", {"val": "5"})])
        walker = _make_mock_walker(
            auto_discover=discovered,
            walk_linked_list=result,
        )

        # Mock debugger_state with locals
        debugger_state = MagicMock()
        debugger_state.locals = []

        structures = _build_heap_structures(
            [ann], walker, debugger_state, step_number=2,
        )
        assert len(structures) == 1

    def test_empty_nodes_filtered_by_dedup(self):
        """Structures with 0 nodes should be filtered out."""
        ann = Annotation("linked_list", "empty", root_var="head", next_field="next")
        result = _trav_result("empty", "linked_list", "0x0")  # no nodes
        walker = _make_mock_walker(walk_linked_list=result)
        structures = _build_heap_structures([ann], walker)
        assert len(structures) == 0


# ── build_snapshot ─────────────────────────────────────────────────────

class TestBuildSnapshot:
    def test_basic_snapshot_shape(self):
        """build_snapshot produces a dict with all expected keys."""
        debugger_state = MagicMock()
        debugger_state.locals = []
        debugger_state.call_stack = []
        debugger_state.source_line = 42
        debugger_state.file = "main.cpp"
        debugger_state.current_function = "main"
        debugger_state.is_terminated = False
        debugger_state.exit_code = 0
        type(debugger_state).stdout = PropertyMock(return_value="Hello")

        snap = build_snapshot(1, debugger_state)

        assert snap["step_number"] == 1
        assert snap["source_line"] == 42
        assert snap["file"] == "main.cpp"
        assert snap["current_function"] == "main"
        assert snap["locals"] == []
        assert snap["call_stack"] == []
        assert snap["heap_structures"] == []
        assert snap["candidates"] == []
        assert snap["stdout"] == "Hello"
        assert snap["is_terminated"] is False
        assert snap["exit_code"] == 0
        assert "operation_summary" in snap

    def test_locals_converted_correctly(self):
        from debugger import Variable
        debugger_state = MagicMock()
        debugger_state.locals = [
            Variable(name="x", type="int", value="5", display_value="5", is_pointer=False, deref_type=None),
            Variable(name="p", type="Node*", value="0x1000", display_value="0x1000", is_pointer=True, deref_type="Node"),
        ]
        debugger_state.call_stack = []
        debugger_state.source_line = 10
        debugger_state.file = "main.cpp"
        debugger_state.current_function = "main"
        debugger_state.is_terminated = False
        debugger_state.exit_code = 0
        type(debugger_state).stdout = PropertyMock(return_value="")

        snap = build_snapshot(1, debugger_state)
        assert len(snap["locals"]) == 2
        assert snap["locals"][0]["name"] == "x"
        assert snap["locals"][0]["is_pointer"] is False
        assert snap["locals"][1]["name"] == "p"
        assert snap["locals"][1]["is_pointer"] is True

    def test_call_stack_converted_correctly(self):
        from debugger import StackFrame
        debugger_state = MagicMock()
        debugger_state.locals = []
        debugger_state.call_stack = [
            StackFrame("main", 5, "main.cpp"),
            StackFrame("foo", 12, "main.cpp"),
        ]
        debugger_state.source_line = 12
        debugger_state.file = "main.cpp"
        debugger_state.current_function = "foo"
        debugger_state.is_terminated = False
        debugger_state.exit_code = 0
        type(debugger_state).stdout = PropertyMock(return_value="")

        snap = build_snapshot(2, debugger_state)
        assert len(snap["call_stack"]) == 2
        assert snap["call_stack"][0]["function"] == "main"
        assert snap["call_stack"][1]["function"] == "foo"

    def test_with_mocked_walker_and_annotations(self):
        from debugger import Variable, StackFrame
        ann = Annotation("linked_list", "list", root_var="head", next_field="next")
        result = _trav_result("list", "linked_list", "0x1",
                              nodes=[_hnode("0x1", "Node(5)", {"val": "5"})])
        walker = _make_mock_walker(walk_linked_list=result)

        debugger_state = MagicMock()
        debugger_state.locals = [Variable(name="head", type="Node*", value="0x1", display_value="0x1", is_pointer=True, deref_type="Node")]
        debugger_state.call_stack = [StackFrame("main", 10, "main.cpp")]
        debugger_state.source_line = 10
        debugger_state.file = "main.cpp"
        debugger_state.current_function = "main"
        debugger_state.is_terminated = False
        debugger_state.exit_code = 0
        type(debugger_state).stdout = PropertyMock(return_value="")

        snap = build_snapshot(3, debugger_state, annotations=[ann], walker=walker)
        assert len(snap["heap_structures"]) == 1
        assert len(snap["candidates"]) >= 1
        assert snap["heap_structures"][0]["structure_type"] == "linked_list"

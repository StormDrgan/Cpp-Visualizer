"""Tests for backend/diff.py — the snapshot diff engine."""

from __future__ import annotations

import pytest
from diff import compute_diff, DiffAction


# ── Helpers for building test structures ──────────────────────────────

def _node(addr: str, fields: dict | None = None, pointers: list[str] | None = None):
    """Build a minimal heap-structure node dict."""
    n: dict = {"addr": addr, "fields": fields or {}, "pointers_pointing_here": pointers or []}
    return n


def _struct(name: str, nodes: list[dict], *, structure_type: str = "linked_list"):
    """Build a minimal heap-structure dict."""
    return {
        "annotation_name": name,
        "structure_type": structure_type,
        "nodes": nodes,
    }


# ── compute_diff ──────────────────────────────────────────────────────

class TestComputeDiffEmptyPrev:
    """When prev_structures is empty (first snapshot), everything is created."""

    def test_empty_both_returns_no_change(self):
        # Both empty: prev is falsy → first branch iterates empty curr → returns []
        assert compute_diff([], []) == []

    def test_first_snapshot_creates_all_nodes(self):
        curr = [_struct("list", [_node("0x1"), _node("0x2")])]
        result = compute_diff([], curr)
        created = [a for a in result if a.action == "node_created"]
        assert len(created) == 2
        assert {a.node_addr for a in created} == {"0x1", "0x2"}

    def test_first_snapshot_records_pointer_positions(self):
        curr = [_struct("list", [_node("0x1", pointers=["head"])])]
        result = compute_diff([], curr)
        ptr_actions = [a for a in result if a.action == "pointer_relocated"]
        assert len(ptr_actions) == 1
        assert ptr_actions[0].detail["pointer"] == "head"
        assert ptr_actions[0].detail["to_addr"] == "0x1"
        assert ptr_actions[0].detail["from_addr"] is None


class TestComputeDiffEmptyCurr:
    """When curr_structures is empty, returns empty list."""

    def test_empty_curr_returns_empty(self):
        prev = [_struct("list", [_node("0x1")])]
        assert compute_diff(prev, []) == []


class TestComputeDiffNodeChanges:
    """Node creation, removal, and value changes."""

    def test_node_created(self):
        prev = [_struct("list", [_node("0x1")])]
        curr = [_struct("list", [_node("0x1"), _node("0x2")])]
        result = compute_diff(prev, curr)
        created = [a for a in result if a.action == "node_created"]
        assert len(created) == 1
        assert created[0].node_addr == "0x2"

    def test_node_removed(self):
        prev = [_struct("list", [_node("0x1"), _node("0x2")])]
        curr = [_struct("list", [_node("0x1")])]
        result = compute_diff(prev, curr)
        removed = [a for a in result if a.action == "node_removed"]
        assert len(removed) == 1
        assert removed[0].node_addr == "0x2"

    def test_value_changed(self):
        prev = [_struct("list", [_node("0x1", {"val": "10"})])]
        curr = [_struct("list", [_node("0x1", {"val": "20"})])]
        result = compute_diff(prev, curr)
        changed = [a for a in result if a.action == "value_changed"]
        assert len(changed) == 1
        assert changed[0].node_addr == "0x1"
        assert changed[0].detail["changed_fields"]["val"] == {"old": "10", "new": "20"}

    def test_value_unchanged_not_reported(self):
        prev = [_struct("list", [_node("0x1", {"val": "10"})])]
        curr = [_struct("list", [_node("0x1", {"val": "10"})])]
        result = compute_diff(prev, curr)
        changed = [a for a in result if a.action == "value_changed"]
        assert len(changed) == 0

    def test_multiple_fields_changed(self):
        prev = [_struct("list", [_node("0x1", {"val": "10", "next": "0x2"})])]
        curr = [_struct("list", [_node("0x1", {"val": "20", "next": "0x3"})])]
        result = compute_diff(prev, curr)
        changed = [a for a in result if a.action == "value_changed"]
        assert len(changed) == 1
        assert "next" in changed[0].detail["changed_fields"]
        assert "val" in changed[0].detail["changed_fields"]


class TestComputeDiffPointerRelocation:
    """Pointer movement detection."""

    def test_pointer_moved(self):
        prev = [_struct("list", [_node("0x1", pointers=["head"])])]
        curr = [_struct("list", [_node("0x2", pointers=["head"])])]
        result = compute_diff(prev, curr)
        ptr_actions = [a for a in result if a.action == "pointer_relocated"]
        assert len(ptr_actions) == 1
        assert ptr_actions[0].detail["pointer"] == "head"
        assert ptr_actions[0].detail["from_addr"] == "0x1"
        assert ptr_actions[0].detail["to_addr"] == "0x2"

    def test_pointer_appeared(self):
        prev = [_struct("list", [_node("0x1", pointers=[])])]
        curr = [_struct("list", [_node("0x1", pointers=["slow"])])]
        result = compute_diff(prev, curr)
        ptr_actions = [a for a in result if a.action == "pointer_relocated"]
        assert len(ptr_actions) == 1
        assert ptr_actions[0].detail["from_addr"] is None
        assert ptr_actions[0].detail["to_addr"] == "0x1"

    def test_pointer_disappeared(self):
        prev = [_struct("list", [_node("0x1", pointers=["fast"])])]
        curr = [_struct("list", [_node("0x1", pointers=[])])]
        result = compute_diff(prev, curr)
        ptr_actions = [a for a in result if a.action == "pointer_relocated"]
        assert len(ptr_actions) == 1
        assert ptr_actions[0].detail["from_addr"] == "0x1"
        assert ptr_actions[0].detail["to_addr"] is None


class TestComputeDiffNoChange:
    """When nothing changes, return no_change."""

    def test_no_change_single_structure(self):
        s = [_struct("list", [_node("0x1", {"val": "10"}, pointers=["head"])])]
        result = compute_diff(s, s)
        assert result == [DiffAction(action="no_change", structure_name="")]

    def test_no_change_multiple_structures(self):
        s = [
            _struct("list", [_node("0x1")]),
            _struct("tree", [_node("0x2", {"val": "5"})]),
        ]
        result = compute_diff(s, s)
        assert result == [DiffAction(action="no_change", structure_name="")]


class TestComputeDiffNewStructure:
    """When a completely new structure appears in curr."""

    def test_new_structure_all_nodes_created(self):
        prev = [_struct("list", [_node("0x1")])]
        curr = [
            _struct("list", [_node("0x1")]),
            _struct("tree", [_node("0xA"), _node("0xB")]),
        ]
        result = compute_diff(prev, curr)
        created = [a for a in result if a.action == "node_created"]
        assert len(created) == 2
        assert {a.node_addr for a in created} == {"0xA", "0xB"}


# ── _detect_sort_actions ──────────────────────────────────────────────

class TestDetectSortActions:
    def test_no_show_vars_returns_empty(self):
        prev = _struct("arr", [_node("0x1", {"val": "2"}), _node("0x2", {"val": "1"})])
        curr = _struct("arr", [_node("0x1", {"val": "2"}), _node("0x2", {"val": "1"})])
        # No show_vars passed → sort detection skipped
        result = compute_diff([prev], [curr], show_vars=None)
        sort_actions = [a for a in result if a.action in ("element_compared", "element_swapped")]
        assert len(sort_actions) == 0

    def test_element_compared_when_two_pointers_move(self):
        prev = _struct("arr", [
            _node("0x1", {"val": "5"}, pointers=["i"]),
            _node("0x2", {"val": "3"}, pointers=["j"]),
        ])
        curr = _struct("arr", [
            _node("0x1", {"val": "5"}, pointers=["j"]),
            _node("0x2", {"val": "3"}, pointers=["i"]),
        ])
        result = compute_diff([prev], [curr], show_vars=["i", "j"])
        compared = [a for a in result if a.action == "element_compared"]
        assert len(compared) >= 1

    def test_element_swapped_by_cross_match(self):
        prev = _struct("arr", [
            _node("0x1", {"val": "2"}, pointers=["i"]),
            _node("0x2", {"val": "1"}, pointers=["j"]),
        ])
        curr = _struct("arr", [
            _node("0x1", {"val": "1"}, pointers=["i"]),
            _node("0x2", {"val": "2"}, pointers=["j"]),
        ])
        result = compute_diff([prev], [curr], show_vars=["i", "j"])
        swapped = [a for a in result if a.action == "element_swapped"]
        assert len(swapped) >= 1
        addrs = set(swapped[0].node_addr.split(","))
        assert addrs == {"0x1", "0x2"}

    def test_swapped_value_changed_actions_suppressed(self):
        prev = _struct("arr", [
            _node("0x1", {"val": "2"}),
            _node("0x2", {"val": "1"}),
        ])
        curr = _struct("arr", [
            _node("0x1", {"val": "1"}),
            _node("0x2", {"val": "2"}),
        ])
        result = compute_diff([prev], [curr], show_vars=["i", "j"])
        # value_changed should be suppressed when swap is detected
        changed = [a for a in result if a.action == "value_changed"]
        swapped = [a for a in result if a.action == "element_swapped"]
        if swapped:
            # The swapped addrs should not have value_changed actions
            swapped_addrs = set()
            for s in swapped:
                swapped_addrs.update(s.node_addr.split(","))
            for c in changed:
                assert c.node_addr not in swapped_addrs

    def test_pointer_crossing_detects_swap(self):
        prev = _struct("arr", [
            _node("0x1", {"val": "2"}, pointers=["i"]),
            _node("0x2", {"val": "1"}, pointers=["j"]),
        ])
        curr = _struct("arr", [
            _node("0x1", {"val": "2"}, pointers=["j"]),
            _node("0x2", {"val": "1"}, pointers=["i"]),
        ])
        result = compute_diff([prev], [curr], show_vars=["i", "j"])
        swapped = [a for a in result if a.action == "element_swapped"]
        assert len(swapped) >= 1


# ── _detect_stack_queue_actions ───────────────────────────────────────

class TestDetectStackActions:
    def test_stack_push(self):
        prev = _struct("s", [_node("0x1")], structure_type="stack")
        curr = _struct("s", [_node("0x1"), _node("0x2")], structure_type="stack")
        result = compute_diff([prev], [curr])
        pushed = [a for a in result if a.action == "node_pushed"]
        assert len(pushed) == 1
        assert pushed[0].node_addr == "0x2"
        assert pushed[0].detail["direction"] == "top"

    def test_stack_pop(self):
        prev = _struct("s", [_node("0x1"), _node("0x2")], structure_type="stack")
        curr = _struct("s", [_node("0x1")], structure_type="stack")
        result = compute_diff([prev], [curr])
        popped = [a for a in result if a.action == "node_popped"]
        assert len(popped) == 1
        assert popped[0].node_addr == "0x2"
        assert popped[0].detail["direction"] == "top"

    def test_stack_node_created_suppressed_when_push_detected(self):
        prev = _struct("s", [_node("0x1")], structure_type="stack")
        curr = _struct("s", [_node("0x1"), _node("0x2")], structure_type="stack")
        result = compute_diff([prev], [curr])
        # node_created for 0x2 should be suppressed in favor of node_pushed
        created = [a for a in result if a.action == "node_created" and a.node_addr == "0x2"]
        assert len(created) == 0

    def test_non_stack_structure_ignored(self):
        prev = _struct("list", [_node("0x1")], structure_type="linked_list")
        curr = _struct("list", [_node("0x1"), _node("0x2")], structure_type="linked_list")
        result = compute_diff([prev], [curr])
        sq_actions = [a for a in result if a.action in ("node_pushed", "node_popped")]
        assert len(sq_actions) == 0


class TestDetectQueueActions:
    def test_queue_enqueue(self):
        prev = _struct("q", [_node("0x1")], structure_type="queue")
        curr = _struct("q", [_node("0x1"), _node("0x2")], structure_type="queue")
        result = compute_diff([prev], [curr])
        pushed = [a for a in result if a.action == "node_pushed"]
        assert len(pushed) == 1
        assert pushed[0].node_addr == "0x2"
        assert pushed[0].detail["direction"] == "rear"

    def test_queue_dequeue(self):
        prev = _struct("q", [_node("0x1"), _node("0x2")], structure_type="queue")
        curr = _struct("q", [_node("0x2")], structure_type="queue")
        result = compute_diff([prev], [curr])
        popped = [a for a in result if a.action == "node_popped"]
        assert len(popped) == 1
        assert popped[0].node_addr == "0x1"
        assert popped[0].detail["direction"] == "front"


# ── _detect_heap_path_swap ────────────────────────────────────────────

class TestDetectHeapPathSwap:
    def test_non_heap_returns_no_path_swap(self):
        prev = _struct("arr", [
            _node("0x1", {"index": "0", "val": "5"}),
            _node("0x2", {"index": "1", "val": "3"}),
        ], structure_type="array")
        curr = _struct("arr", [
            _node("0x1", {"index": "0", "val": "3"}),
            _node("0x2", {"index": "1", "val": "5"}),
        ], structure_type="array")
        result = compute_diff([prev], [curr])
        path_swaps = [a for a in result if a.action == "node_path_swapped"]
        assert len(path_swaps) == 0

    def test_less_than_two_changes_returns_empty(self):
        prev = _struct("h", [
            _node("0x1", {"index": "0", "val": "10"}),
            _node("0x2", {"index": "1", "val": "5"}),
        ], structure_type="heap")
        curr = _struct("h", [
            _node("0x1", {"index": "0", "val": "20"}),
            _node("0x2", {"index": "1", "val": "5"}),
        ], structure_type="heap")
        result = compute_diff([prev], [curr])
        path_swaps = [a for a in result if a.action == "node_path_swapped"]
        assert len(path_swaps) == 0  # only 1 change

    def test_parent_child_path_detected(self):
        """Parent at index 0 and child at index 1 both change → path detected."""
        prev = _struct("h", [
            _node("0x0", {"index": "0", "val": "3"}),
            _node("0x1", {"index": "1", "val": "10"}),
        ], structure_type="heap")
        curr = _struct("h", [
            _node("0x0", {"index": "0", "val": "10"}),
            _node("0x1", {"index": "1", "val": "3"}),
        ], structure_type="heap")
        result = compute_diff([prev], [curr])
        path_swaps = [a for a in result if a.action == "node_path_swapped"]
        assert len(path_swaps) == 1
        assert path_swaps[0].detail["path_indices"] == [0, 1]

    def test_sift_up_chain(self):
        """Index 3→1→0 path forms a chain (all three must change values)."""
        prev = _struct("h", [
            _node("0x0", {"index": "0", "val": "5"}),
            _node("0x1", {"index": "1", "val": "8"}),
            _node("0x3", {"index": "3", "val": "2"}),
        ], structure_type="heap")
        curr = _struct("h", [
            _node("0x0", {"index": "0", "val": "2"}),
            _node("0x1", {"index": "1", "val": "5"}),  # index 1 also changes
            _node("0x3", {"index": "3", "val": "8"}),
        ], structure_type="heap")
        result = compute_diff([prev], [curr])
        path_swaps = [a for a in result if a.action == "node_path_swapped"]
        assert len(path_swaps) == 1
        assert 0 in path_swaps[0].detail["path_indices"]
        assert 3 in path_swaps[0].detail["path_indices"]

    def test_no_index_field_skipped(self):
        prev = _struct("h", [
            _node("0x1", {"val": "10"}),
            _node("0x2", {"val": "5"}),
        ], structure_type="heap")
        curr = _struct("h", [
            _node("0x1", {"val": "5"}),
            _node("0x2", {"val": "10"}),
        ], structure_type="heap")
        result = compute_diff([prev], [curr])
        path_swaps = [a for a in result if a.action == "node_path_swapped"]
        assert len(path_swaps) == 0  # no index fields → can't detect path


# ── Integration-style tests ────────────────────────────────────────────

class TestComputeDiffIntegration:
    """Tests that exercise multiple diff types together."""

    def test_sort_animation_scenario(self):
        """Simulate one step of bubble sort: compare then swap."""
        prev = _struct("arr", [
            _node("0x1", {"val": "5"}, pointers=["i"]),
            _node("0x2", {"val": "3"}, pointers=["j"]),
            _node("0x3", {"val": "8"}),
        ], structure_type="array")
        curr = _struct("arr", [
            _node("0x1", {"val": "3"}, pointers=["i"]),
            _node("0x2", {"val": "5"}, pointers=["j"]),
            _node("0x3", {"val": "8"}),
        ], structure_type="array")
        result = compute_diff([prev], [curr], show_vars=["i", "j"])
        actions = {a.action for a in result}
        # Should have swap detection
        assert "element_swapped" in actions
        # Node 0x3 should have no_change (not reported)
        assert "node_created" not in actions

    def test_linked_list_traversal_scenario(self):
        """Pointer moves from 0x1 to 0x2."""
        prev = _struct("list", [
            _node("0x1", {"val": "10"}, pointers=["curr"]),
            _node("0x2", {"val": "20"}),
        ])
        curr = _struct("list", [
            _node("0x1", {"val": "10"}),
            _node("0x2", {"val": "20"}, pointers=["curr"]),
        ])
        result = compute_diff([prev], [curr])
        ptr_actions = [a for a in result if a.action == "pointer_relocated"]
        assert len(ptr_actions) == 1
        assert ptr_actions[0].detail["pointer"] == "curr"
        assert ptr_actions[0].detail["from_addr"] == "0x1"
        assert ptr_actions[0].detail["to_addr"] == "0x2"

    def test_multiple_structures_independent(self):
        prev = [
            _struct("list", [_node("0x1", {"val": "1"})]),
            _struct("tree", [_node("0xA", {"val": "100"})]),
        ]
        curr = [
            _struct("list", [_node("0x1", {"val": "2"})]),
            _struct("tree", [_node("0xA", {"val": "200"})]),
        ]
        result = compute_diff(prev, curr)
        changed = [a for a in result if a.action == "value_changed"]
        assert len(changed) == 2
        names = {a.structure_name for a in changed}
        assert names == {"list", "tree"}


# ── DiffAction dataclass ──────────────────────────────────────────────

class TestDiffActionDataclass:
    def test_defaults(self):
        a = DiffAction(action="no_change", structure_name="test")
        assert a.node_addr == ""
        assert a.detail == {}

    def test_equality(self):
        a = DiffAction(action="node_created", structure_name="s", node_addr="0x1")
        b = DiffAction(action="node_created", structure_name="s", node_addr="0x1")
        assert a == b

    def test_inequality(self):
        a = DiffAction(action="node_created", structure_name="s", node_addr="0x1")
        b = DiffAction(action="node_removed", structure_name="s", node_addr="0x1")
        assert a != b

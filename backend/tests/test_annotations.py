"""Tests for backend/annotations.py — @viz annotation parser."""

from __future__ import annotations

import pytest
from annotations import parse_annotations, get_show_vars, Annotation


# ── Parametrized tests: one per annotation type ────────────────────────

@pytest.mark.parametrize("source,expected", [
    # linked_list (singly)
    (
        '// @viz linked_list(list1) head=head.next_field=next',
        Annotation("linked_list", "list1", root_var="head", next_field="next"),
    ),
    # linked_list (doubly)
    (
        '// @viz linked_list(dlist) head=head.next_field=next.prev_field=prev',
        Annotation("linked_list", "dlist", root_var="head", next_field="next", prev_field="prev"),
    ),
    # binary_tree
    (
        '// @viz binary_tree(t) root=root.left_field=left.right_field=right',
        Annotation("binary_tree", "t", root_var="root", left_field="left", right_field="right"),
    ),
    # array
    (
        '// @viz array(arr) var=arr.length_var=n',
        Annotation("array", "arr", root_var="arr", length_var="n"),
    ),
    # stack (sequential)
    (
        '// @viz stack(s) var=data.top_var=top',
        Annotation("stack", "s", root_var="data", top_var="top"),
    ),
    # stack (linked)
    (
        '// @viz stack(s) var=top.next_field=next',
        Annotation("stack", "s", root_var="top", next_field="next"),
    ),
    # queue (circular)
    (
        '// @viz queue(q) var=data.front_var=front.rear_var=rear',
        Annotation("queue", "q", root_var="data", front_var="front", rear_var="rear"),
    ),
    # queue (linked)
    (
        '// @viz queue(q) var=front.next_field=next',
        Annotation("queue", "q", root_var="front", next_field="next"),
    ),
    # heap (with length_var)
    (
        '// @viz heap(h) var=data.length_var=size',
        Annotation("heap", "h", root_var="data", length_var="size"),
    ),
    # heap (without length_var — optional)
    (
        '// @viz heap(h) var=data',
        Annotation("heap", "h", root_var="data"),
    ),
    # graph (matrix)
    (
        '// @viz graph(g) var=mat.mode=matrix.size_var=n',
        Annotation("graph", "g", root_var="mat", mode="matrix", length_var="n"),
    ),
    # graph (adjlist)
    (
        '// @viz graph(g) var=adj.size_var=n',
        Annotation("graph", "g", root_var="adj", mode="adjlist", length_var="n"),
    ),
    # hashmap (chaining)
    (
        '// @viz hashmap(hm) var=table.mode=chaining',
        Annotation("hashmap", "hm", root_var="table", mode="chaining"),
    ),
    # hashmap (defaults to chaining when mode omitted)
    (
        '// @viz hashmap(hm) var=table',
        Annotation("hashmap", "hm", root_var="table", mode="chaining"),
    ),
    # recursion_tree
    (
        '// @viz recursion_tree(rt)',
        Annotation("recursion_tree", "rt"),
    ),
    # b_tree
    (
        '// @viz b_tree(bt) root=root.order=5',
        Annotation("b_tree", "bt", root_var="root", length_var="5"),
    ),
    # bplustree
    (
        '// @viz bplustree(bp) root=root.order=6',
        Annotation("bplustree", "bp", root_var="root", length_var="6"),
    ),
    # show
    (
        '// @viz show(slow, fast, cur)',
        Annotation("show", "", show_vars=["slow", "fast", "cur"]),
    ),
    # show (single)
    (
        '// @viz show(ptr)',
        Annotation("show", "", show_vars=["ptr"]),
    ),
])
def test_parse_single_annotation(source, expected):
    result = parse_annotations(source)
    assert len(result) == 1, f"Expected 1 annotation, got {len(result)} for: {source}"
    assert result[0] == expected


# ── Multi-annotation tests ─────────────────────────────────────────────

def test_multiple_annotations_in_source():
    source = """
#include <iostream>
// @viz linked_list(list) head=head.next_field=next
int main() {
    // @viz array(arr) var=arr.length_var=n
    return 0;
}
"""
    result = parse_annotations(source)
    assert len(result) == 2
    assert result[0].struct_type == "linked_list"
    assert result[1].struct_type == "array"


def test_non_comment_lines_skipped():
    source = """
int x = 5;
// @viz array(a) var=a.length_var=n
struct Node { int val; Node* next; };
"""
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].struct_type == "array"


def test_malformed_comment_lines_ignored():
    source = """
// This is just a comment
// @viz unknown_type(x) var=x
// @viz array(
"""
    result = parse_annotations(source)
    assert len(result) == 0


def test_mixed_valid_and_invalid():
    source = """
// @viz linked_list(l) head=head.next_field=next
// This is a regular comment
// @viz binary_tree(t) root=root.left_field=left.right_field=right
"""
    result = parse_annotations(source)
    assert len(result) == 2


def test_empty_source():
    assert parse_annotations("") == []


def test_no_annotations():
    source = """
int main() {
    int x = 0;
    return x;
}
"""
    assert parse_annotations(source) == []


def test_comment_without_viz_prefix():
    source = "// linked_list(list) head=head.next_field=next"
    result = parse_annotations(source)
    assert len(result) == 0


# ── Priority / ordering tests ──────────────────────────────────────────

def test_doubly_before_singly():
    """Doubly linked_list regex must match before singly regex."""
    source = '// @viz linked_list(d) head=h.next_field=n.prev_field=p'
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].prev_field == "p"  # doubly matched


# ── Pointer chaining ──────────────────────────────────────────────────

def test_pointer_chain_in_root_var():
    source = '// @viz linked_list(l) head=obj->head.next_field=next'
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].root_var == "obj->head"


def test_pointer_chain_in_stack_var():
    source = '// @viz stack(s) var=obj->data.top_var=top'
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].root_var == "obj->data"


# ── get_show_vars ──────────────────────────────────────────────────────

def test_get_show_vars_empty():
    assert get_show_vars([]) == []


def test_get_show_vars_no_show_annotations():
    anns = [Annotation("linked_list", "l"), Annotation("array", "a")]
    assert get_show_vars(anns) == []


def test_get_show_vars_single():
    anns = [Annotation("show", "", show_vars=["i", "j"])]
    assert get_show_vars(anns) == ["i", "j"]


def test_get_show_vars_multiple():
    anns = [
        Annotation("show", "", show_vars=["i"]),
        Annotation("show", "", show_vars=["j", "k"]),
    ]
    assert get_show_vars(anns) == ["i", "j", "k"]


def test_get_show_vars_mixed():
    anns = [
        Annotation("linked_list", "l"),
        Annotation("show", "", show_vars=["slow", "fast"]),
        Annotation("array", "a"),
    ]
    assert get_show_vars(anns) == ["slow", "fast"]


# ── Edge cases ─────────────────────────────────────────────────────────

def test_whitespace_tolerance():
    """Extra spaces in annotation should still parse (regex uses \\s+ between tokens)."""
    source = '//   @viz   linked_list(l)   head=head.next_field=next'
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].struct_type == "linked_list"
    assert result[0].name == "l"


def test_name_with_numbers():
    source = '// @viz linked_list(list2) head=h1.next_field=nxt2'
    result = parse_annotations(source)
    assert len(result) == 1
    assert result[0].name == "list2"
    assert result[0].next_field == "nxt2"

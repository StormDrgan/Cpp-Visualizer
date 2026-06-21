"""@viz annotation parser — extracts data structure annotations from C++ source code.

Supports:
  // @viz linked_list(name) head=root_var.next_field=field_name
  // @viz watch(ptr1, ptr2, ...)

See DESIGN.md §4.4 and §8.5 for the annotation syntax.
"""

import re
from dataclasses import dataclass, field


@dataclass
class Annotation:
    """A single parsed @viz annotation."""
    struct_type: str           # "linked_list", "binary_tree", "array", "stack",
                               # "queue", "heap", "graph", "hashmap", "watch",
                               # "recursion_tree"
    name: str                  # user-given name for this structure
    root_var: str = ""         # root pointer variable
    next_field: str = ""       # field name for the "next" pointer
    left_field: str = ""       # for binary_tree
    right_field: str = ""      # for binary_tree
    length_var: str = ""       # for array, heap capacity, hashmap bucket count
    top_var: str = ""          # for stack — index variable tracking the top
    front_var: str = ""        # for queue — index variable tracking the front
    rear_var: str = ""         # for queue — index variable tracking the rear
    mode: str = ""             # for hashmap: "chaining" (default) or "open_addressing"
    watched_vars: list[str] = field(default_factory=list)  # for "watch"
    prev_field: str = ""       # for doubly linked list (v0.9)
    tree_variant: str = ""     # "avl" | "threaded" | "" (v0.9)
    is_circular: bool = False  # for circular linked list (v0.9)


# Regex patterns
_LINKED_LIST_RE = re.compile(
    r'@viz\s+linked_list\((\w+)\)'
    r'\s+head=(\w+(?:->\w+)*)'
    r'\.next_field=(\w+)'
)

_LINKED_LIST_DOUBLY_RE = re.compile(
    r'@viz\s+linked_list\((\w+)\)'
    r'\s+head=(\w+(?:->\w+)*)'
    r'\.next_field=(\w+)'
    r'\.prev_field=(\w+)'
)

_BINARY_TREE_RE = re.compile(
    r'@viz\s+binary_tree\((\w+)\)'
    r'\s+root=(\w+(?:->\w+)*)'
    r'\.left_field=(\w+)'
    r'\.right_field=(\w+)'
)

_ARRAY_RE = re.compile(
    r'@viz\s+array\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.length_var=(\w+)'
)

_STACK_RE = re.compile(
    r'@viz\s+stack\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.top_var=(\w+)'
)

_STACK_LINKED_RE = re.compile(
    r'@viz\s+stack\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.next_field=(\w+)'
)

_QUEUE_CIRCULAR_RE = re.compile(
    r'@viz\s+queue\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.front_var=(\w+)'
    r'\.rear_var=(\w+)'
)

_QUEUE_LINKED_RE = re.compile(
    r'@viz\s+queue\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.next_field=(\w+)'
)

_HEAP_RE = re.compile(
    r'@viz\s+heap\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'(?:\.length_var=(\w+))?'
)

_GRAPH_MATRIX_RE = re.compile(
    r'@viz\s+graph\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'\.mode=matrix'
    r'(?:\.size_var=(\w+))?'
)

_GRAPH_ADJLIST_RE = re.compile(
    r'@viz\s+graph\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'(?:\.size_var=(\w+))?'
)

_HASHMAP_RE = re.compile(
    r'@viz\s+hashmap\((\w+)\)'
    r'\s+var=(\w+(?:->\w+)*)'
    r'(?:\.mode=(\w+))?'
)

_WATCH_RE = re.compile(
    r'@viz\s+watch\(([^)]+)\)'
)

_RECURSION_TREE_RE = re.compile(
    r'@viz\s+recursion_tree\((\w+)\)'
)


def parse_annotations(source_code: str) -> list[Annotation]:
    """Extract all @viz annotations from source code.

    Args:
        source_code: C++ source code as a string.

    Returns:
        List of parsed Annotation objects.
    """
    annotations: list[Annotation] = []

    for line in source_code.split('\n'):
        stripped = line.strip()

        # Skip non-comment lines
        if not stripped.startswith('//'):
            continue

        # Try doubly linked_list (with prev_field)
        m = _LINKED_LIST_DOUBLY_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="linked_list",
                name=m.group(1),
                root_var=m.group(2),
                next_field=m.group(3),
                prev_field=m.group(4),
            ))
            continue

        # Try linked_list
        m = _LINKED_LIST_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="linked_list",
                name=m.group(1),
                root_var=m.group(2),
                next_field=m.group(3),
            ))
            continue

        # Try binary_tree
        m = _BINARY_TREE_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="binary_tree",
                name=m.group(1),
                root_var=m.group(2),
                left_field=m.group(3),
                right_field=m.group(4),
            ))
            continue

        # Try array
        m = _ARRAY_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="array",
                name=m.group(1),
                root_var=m.group(2),
                length_var=m.group(3),
            ))
            continue

        # Try stack (sequential — array-based)
        m = _STACK_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="stack",
                name=m.group(1),
                root_var=m.group(2),
                top_var=m.group(3),
            ))
            continue

        # Try stack (linked — pointer-based)
        m = _STACK_LINKED_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="stack",
                name=m.group(1),
                root_var=m.group(2),
                next_field=m.group(3),
            ))
            continue

        # Try queue (circular — array-based)
        m = _QUEUE_CIRCULAR_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="queue",
                name=m.group(1),
                root_var=m.group(2),
                front_var=m.group(3),
                rear_var=m.group(4),
            ))
            continue

        # Try queue (linked — pointer-based)
        m = _QUEUE_LINKED_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="queue",
                name=m.group(1),
                root_var=m.group(2),
                next_field=m.group(3),
            ))
            continue

        # Try heap (binary heap, array-based)
        m = _HEAP_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="heap",
                name=m.group(1),
                root_var=m.group(2),
                length_var=m.group(3) or "",
            ))
            continue

        # Try graph (adjacency matrix)
        m = _GRAPH_MATRIX_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="graph",
                name=m.group(1),
                root_var=m.group(2),
                mode="matrix",
                length_var=m.group(3) or "",
            ))
            continue

        # Try graph (adjacency list)
        m = _GRAPH_ADJLIST_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="graph",
                name=m.group(1),
                root_var=m.group(2),
                mode="adjlist",
                length_var=m.group(3) or "",
            ))
            continue

        # Try hashmap
        m = _HASHMAP_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="hashmap",
                name=m.group(1),
                root_var=m.group(2),
                mode=m.group(3) or "chaining",
            ))
            continue

        # Try recursion_tree (v0.9)
        m = _RECURSION_TREE_RE.search(stripped)
        if m:
            annotations.append(Annotation(
                struct_type="recursion_tree",
                name=m.group(1),
            ))
            continue

        # Try watch
        m = _WATCH_RE.search(stripped)
        if m:
            vars_str = m.group(1)
            watched = [v.strip() for v in vars_str.split(',') if v.strip()]
            annotations.append(Annotation(
                struct_type="watch",
                name="",
                watched_vars=watched,
            ))
            continue

    return annotations


def get_watched_vars(annotations: list[Annotation]) -> list[str]:
    """Collect all watched pointer variables from watch annotations."""
    watched = []
    for ann in annotations:
        if ann.struct_type == "watch":
            watched.extend(ann.watched_vars)
    return watched

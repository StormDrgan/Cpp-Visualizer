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
    struct_type: str           # "linked_list", "binary_tree", "array", "graph", "watch"
    name: str                  # user-given name for this structure
    root_var: str = ""         # root pointer variable
    next_field: str = ""       # field name for the "next" pointer
    left_field: str = ""       # for binary_tree
    right_field: str = ""      # for binary_tree
    length_var: str = ""       # for array
    watched_vars: list[str] = field(default_factory=list)  # for "watch"


# Regex patterns
_LINKED_LIST_RE = re.compile(
    r'@viz\s+linked_list\((\w+)\)'
    r'\s+head=(\w+(?:->\w+)*)'
    r'\.next_field=(\w+)'
)

_WATCH_RE = re.compile(
    r'@viz\s+watch\(([^)]+)\)'
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

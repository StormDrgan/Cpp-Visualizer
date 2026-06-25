"""Shared per-session state.

Central repository for all session-scoped resources — debugger controllers,
compilers, walkers, annotations, and WebSocket connections. Both the HTTP
router (session.py) and the WebSocket router (ws.py) import from here,
avoiding circular imports and module-level dict clashes.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from debugger import LLDBController
    from compiler import CodeCompiler
    from memory_walker import MemoryWalker
    from annotations import Annotation
    from fastapi import WebSocket

# ---------------------------------------------------------------------------
# Session-scoped resource dicts
# ---------------------------------------------------------------------------

_debuggers: dict[str, "LLDBController"] = {}
_compilers: dict[str, "CodeCompiler"] = {}
_walkers: dict[str, "MemoryWalker"] = {}
_pending_breakpoints: dict[str, set[int]] = {}
_session_annotations: dict[str, list["Annotation"]] = {}
_prev_heap_structures: dict[str, list[dict]] = {}
_prev_call_stacks: dict[str, list[dict]] = {}
_ws_connections: dict[str, "WebSocket"] = {}


# ---------------------------------------------------------------------------
# Debugger
# ---------------------------------------------------------------------------

def get_debugger(session_id: str):
    return _debuggers.get(session_id)

def store_debugger(session_id: str, debugger) -> None:
    _debuggers[session_id] = debugger

def pop_debugger(session_id: str):
    return _debuggers.pop(session_id, None)


# ---------------------------------------------------------------------------
# Compiler
# ---------------------------------------------------------------------------

def get_compiler(session_id: str):
    return _compilers.get(session_id)

def store_compiler(session_id: str, compiler) -> None:
    _compilers[session_id] = compiler

def pop_compiler(session_id: str):
    return _compilers.pop(session_id, None)


# ---------------------------------------------------------------------------
# Memory walker
# ---------------------------------------------------------------------------

def get_walker(session_id: str):
    return _walkers.get(session_id)

def store_walker(session_id: str, walker) -> None:
    _walkers[session_id] = walker

def pop_walker(session_id: str):
    return _walkers.pop(session_id, None)


# ---------------------------------------------------------------------------
# Breakpoints
# ---------------------------------------------------------------------------

def get_breakpoints(session_id: str) -> set[int]:
    return _pending_breakpoints.get(session_id, set())

def store_breakpoints(session_id: str, bps: set[int]) -> None:
    _pending_breakpoints[session_id] = bps

def pop_breakpoints(session_id: str) -> set[int]:
    return _pending_breakpoints.pop(session_id, set())


# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------

def get_annotations(session_id: str) -> list:
    return _session_annotations.get(session_id, [])

def store_annotations(session_id: str, anns: list) -> None:
    _session_annotations[session_id] = anns

def pop_annotations(session_id: str) -> list:
    return _session_annotations.pop(session_id, [])


# ---------------------------------------------------------------------------
# Previous heap structures (for diff)
# ---------------------------------------------------------------------------

def get_prev_structures(session_id: str) -> list[dict]:
    return _prev_heap_structures.get(session_id, [])

def store_prev_structures(session_id: str, structs: list[dict]) -> None:
    _prev_heap_structures[session_id] = structs

def pop_prev_structures(session_id: str) -> list[dict]:
    return _prev_heap_structures.pop(session_id, [])


# ---------------------------------------------------------------------------
# Previous call stack (for recursion tree diff detection)
# ---------------------------------------------------------------------------

def get_prev_call_stack(session_id: str) -> list[dict] | None:
    return _prev_call_stacks.get(session_id)

def store_prev_call_stack(session_id: str, stack: list[dict]) -> None:
    _prev_call_stacks[session_id] = stack

def pop_prev_call_stack(session_id: str) -> list[dict] | None:
    return _prev_call_stacks.pop(session_id, None)


# ---------------------------------------------------------------------------
# WebSocket connections
# ---------------------------------------------------------------------------

def register_ws(session_id: str, ws: "WebSocket") -> None:
    _ws_connections[session_id] = ws

def unregister_ws(session_id: str) -> None:
    _ws_connections.pop(session_id, None)

def get_ws(session_id: str):
    return _ws_connections.get(session_id)


# ---------------------------------------------------------------------------
# Bulk cleanup
# ---------------------------------------------------------------------------

def cleanup_session(session_id: str) -> None:
    """Remove all state associated with a session."""
    d = pop_debugger(session_id)
    if d:
        try:
            d.terminate()
        except Exception:
            pass
    pop_compiler(session_id)
    pop_walker(session_id)
    pop_breakpoints(session_id)
    pop_annotations(session_id)
    pop_prev_structures(session_id)
    pop_prev_call_stack(session_id)
    unregister_ws(session_id)

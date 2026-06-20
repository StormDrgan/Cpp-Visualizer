"""Session API routes — see DESIGN.md §3.2 for the API specification."""

from __future__ import annotations
import os
import shutil

from fastapi import APIRouter, HTTPException

from compiler import CodeCompiler
from config import TEMP_ROOT
from debugger import LLDBController
from session_manager import session_manager
from snapshot import build_snapshot
from annotations import Annotation, parse_annotations
from diff import compute_diff
from memory_walker import MemoryWalker

router = APIRouter(prefix="/api")

# Per-session state
_debuggers: dict[str, LLDBController] = {}
_compilers: dict[str, CodeCompiler] = {}
_walkers: dict[str, MemoryWalker] = {}
_pending_breakpoints: dict[str, set[int]] = {}
_session_annotations: dict[str, list[Annotation]] = {}
_prev_heap_structures: dict[str, list[dict]] = {}


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

@router.post("/session")
async def create_session():
    """Create a new session. Returns a session_id."""
    session_id = session_manager.create()
    _debuggers[session_id] = LLDBController()
    _compilers[session_id] = CodeCompiler()
    _pending_breakpoints[session_id] = set()
    _session_annotations[session_id] = []
    _prev_heap_structures[session_id] = []
    return {"session_id": session_id}


@router.post("/session/{session_id}/load")
async def load_code(session_id: str, body: dict):
    """Load source code, compile it, and start the debugger.

    Request body:
        {"code": "...", "breakpoints": [3, 7, ...]}

    Returns:
        {"success": true, "source_line": 1, ...}
        or
        {"success": false, "errors": [...]}
    """
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    code = body.get("code", "")
    if not code.strip():
        raise HTTPException(status_code=400, detail="No source code provided")

    session.source_code = code
    session.step_number = 0
    session.history.clear()
    session.future.clear()

    # Parse annotations from source code + explicit annotations from frontend
    code_annotations = parse_annotations(code)
    explicit = body.get("annotations", [])

    # Merge explicit annotations (from annotation management UI)
    from dataclasses import asdict
    for item in explicit:
        ann = Annotation(
            struct_type=item.get("struct_type", ""),
            name=item.get("name", ""),
            root_var=item.get("root_var", ""),
            next_field=item.get("next_field", ""),
            left_field=item.get("left_field", ""),
            right_field=item.get("right_field", ""),
            length_var=item.get("length_var", ""),
            watched_vars=item.get("watched_vars", []),
        )
        # Avoid duplicates: skip if same name already parsed from code
        if not any(a.name == ann.name and a.struct_type == ann.struct_type for a in code_annotations):
            code_annotations.append(ann)

    _session_annotations[session_id] = code_annotations

    # Create MemoryWalker (wraps the debugger's send capability)
    debugger = _debuggers[session_id]
    _walkers[session_id] = MemoryWalker(debugger._send_cmd)

    # Compile
    compiler = _compilers[session_id]
    result = compiler.compile(code, session_id)

    if not result.success:
        return {
            "type": "compile_error",
            "payload": {"errors": result.errors},
        }

    session.binary_path = result.binary_path
    session.source_file = "main.cpp"

    # Store breakpoints from the request
    bp_lines = set(body.get("breakpoints", []))
    _pending_breakpoints[session_id] = bp_lines

    # Start debugger
    try:
        debugger.start(result.binary_path, session.source_file)

        # Set requested breakpoints
        for line in bp_lines:
            debugger.set_breakpoint(line)

        # Get initial state (paused at main)
        state = debugger.get_state()
        session.step_number = 1
        snapshot = build_snapshot(
            1, state, session.source_file,
            annotations=annotations,
            walker=_walkers.get(session_id),
        )
        _prev_heap_structures[session_id] = snapshot.get("heap_structures", [])
        session.history.append(snapshot)

        session_manager.start_cleanup_timer(session_id)

        return {
            "type": "snapshot",
            "payload": snapshot,
        }

    except RuntimeError as e:
        return {
            "type": "error",
            "payload": {"message": str(e)},
        }


# ---------------------------------------------------------------------------
# Execution control
# ---------------------------------------------------------------------------

@router.post("/session/{session_id}/step")
async def step(session_id: str, body: dict | None = None):
    """Execute one step (step_over by default).

    Request body (optional):
        {"mode": "step_over" | "step_into" | "step_out"}

    Returns the new state snapshot.
    """
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debugger = _debuggers[session_id]
    if not debugger.is_running():
        return {
            "type": "terminated",
            "payload": {"message": "Program has already terminated. Reset to run again."},
        }

    mode = (body or {}).get("mode", "step_over")

    try:
        if mode == "step_into":
            debugger_state = debugger.step_into()
        elif mode == "step_out":
            debugger_state = debugger.step_out()
        else:
            debugger_state = debugger.step_over()

        session.step_number += 1

        annotations = _session_annotations.get(session_id, [])
        walker = _walkers.get(session_id)
        snapshot = build_snapshot(
            session.step_number, debugger_state, session.source_file,
            annotations=annotations,
            walker=walker,
        )

        # Compute diff
        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = _prev_heap_structures.get(session_id, [])
        diff_actions = compute_diff(prev_structures, curr_structures)
        _prev_heap_structures[session_id] = curr_structures

        # Push to history, clear future
        session.history.append(snapshot)
        session.future.clear()

        session_manager.start_cleanup_timer(session_id)

        return {
            "type": "snapshot",
            "payload": snapshot,
            "diff_actions": [_action_to_dict(a) for a in diff_actions],
        }

    except Exception as e:
        return {
            "type": "error",
            "payload": {"message": str(e)},
        }


@router.post("/session/{session_id}/back")
async def step_back(session_id: str, body: dict | None = None):
    """Step backward by popping from the history stack.

    Request body (optional):
        {"steps": 1}  — default 1, can go back multiple steps

    Returns the previous snapshot from history.
    """
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    steps = (body or {}).get("steps", 1)

    if len(session.history) <= 1:
        return {
            "type": "snapshot",
            "payload": session.history[-1] if session.history else None,
        }

    for _ in range(steps):
        if len(session.history) > 1:
            # Move current from history to future
            current = session.history.pop()
            session.future.append(current)

    session_manager.start_cleanup_timer(session_id)

    return {
        "type": "snapshot",
        "payload": session.history[-1],
    }


@router.post("/session/{session_id}/forward")
async def step_forward(session_id: str):
    """Step forward (redo) — pop from future stack back onto history."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.future:
        return {
            "type": "snapshot",
            "payload": session.history[-1] if session.history else None,
        }

    snapshot = session.future.pop()
    session.history.append(snapshot)

    session_manager.start_cleanup_timer(session_id)

    return {
        "type": "snapshot",
        "payload": snapshot,
    }


@router.post("/session/{session_id}/run-to")
async def run_to(session_id: str, body: dict | None = None):
    """Run until a breakpoint is hit or the program terminates."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debugger = _debuggers[session_id]
    if not debugger.is_running():
        return {
            "type": "terminated",
            "payload": {"message": "Program has already terminated."},
        }

    try:
        debugger_state = debugger.run_to_breakpoint()
        session.step_number += 1

        annotations = _session_annotations.get(session_id, [])
        walker = _walkers.get(session_id)
        snapshot = build_snapshot(
            session.step_number, debugger_state, session.source_file,
            annotations=annotations, walker=walker,
        )

        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = _prev_heap_structures.get(session_id, [])
        diff_actions = compute_diff(prev_structures, curr_structures)
        _prev_heap_structures[session_id] = curr_structures

        session.history.append(snapshot)
        session.future.clear()

        session_manager.start_cleanup_timer(session_id)

        return {
            "type": "snapshot",
            "payload": snapshot,
            "diff_actions": [_action_to_dict(a) for a in diff_actions],
        }

    except Exception as e:
        return {
            "type": "error",
            "payload": {"message": str(e)},
        }


@router.post("/session/{session_id}/reset")
async def reset(session_id: str):
    """Reset the session — kill debugger, clear state, recompile and restart."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debugger = _debuggers[session_id]
    debugger.terminate()

    # Re-create debugger
    _debuggers[session_id] = LLDBController()
    debugger = _debuggers[session_id]

    session.step_number = 0
    session.history.clear()
    session.future.clear()

    # Recompile
    compiler = _compilers[session_id]
    result = compiler.compile(session.source_code, session_id)

    if not result.success:
        return {
            "type": "compile_error",
            "payload": {"errors": result.errors},
        }

    session.binary_path = result.binary_path

    try:
        debugger.start(result.binary_path, session.source_file)

        # Re-apply stored breakpoints
        for line in _pending_breakpoints.get(session_id, set()):
            debugger.set_breakpoint(line)

        state = debugger.get_state()
        session.step_number = 1

        annotations = _session_annotations.get(session_id, [])
        walker = _walkers.get(session_id)
        snapshot = build_snapshot(
            1, state, session.source_file,
            annotations=annotations, walker=walker,
        )
        _prev_heap_structures[session_id] = snapshot.get("heap_structures", [])
        session.history.append(snapshot)

        return {
            "type": "snapshot",
            "payload": snapshot,
        }

    except RuntimeError as e:
        return {
            "type": "error",
            "payload": {"message": str(e)},
        }


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clean up a session — kill debugger, remove temp files, delete state."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Kill debugger
    debugger = _debuggers.pop(session_id, None)
    if debugger:
        debugger.terminate()

    _compilers.pop(session_id, None)
    _walkers.pop(session_id, None)
    _pending_breakpoints.pop(session_id, None)
    _session_annotations.pop(session_id, None)
    _prev_heap_structures.pop(session_id, None)

    # Clean up temp files
    session_dir = os.path.join(TEMP_ROOT, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)

    session_manager.delete(session_id)

    return {"status": "deleted", "session_id": session_id}


# ---------------------------------------------------------------------------
# Breakpoints
# ---------------------------------------------------------------------------

@router.post("/session/{session_id}/set-breakpoint")
async def set_breakpoint(session_id: str, body: dict):
    """Set a breakpoint at a given line."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    line = body.get("line")
    if line is None:
        raise HTTPException(status_code=400, detail="Missing 'line' in request body")

    debugger = _debuggers[session_id]
    debugger.set_breakpoint(line)

    _pending_breakpoints.setdefault(session_id, set()).add(line)

    return {"status": "ok", "line": line}


@router.post("/session/{session_id}/remove-breakpoint")
async def remove_breakpoint(session_id: str, body: dict):
    """Remove a breakpoint at a given line."""
    line = body.get("line")
    if line is None:
        raise HTTPException(status_code=400, detail="Missing 'line' in request body")

    bp_set = _pending_breakpoints.get(session_id, set())
    bp_set.discard(line)

    # LLDB doesn't have a simple "remove breakpoint at line" API,
    # so we just remove it from our tracking set.
    # The breakpoint will be cleaned up on next reset.

    return {"status": "ok", "line": line}


# ---------------------------------------------------------------------------
# Expression evaluation
# ---------------------------------------------------------------------------

@router.post("/session/{session_id}/eval")
async def eval_expression(session_id: str, body: dict):
    """Evaluate an arbitrary expression in the current frame."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    expression = body.get("expression", "")
    if not expression:
        raise HTTPException(status_code=400, detail="Missing 'expression' in request body")

    debugger = _debuggers[session_id]
    result = debugger.evaluate(expression)

    return {"expression": expression, "value": result}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def _action_to_dict(action) -> dict:
    """Convert a DiffAction to a JSON-safe dict."""
    return {
        "action": action.action,
        "structure_name": action.structure_name,
        "node_addr": action.node_addr,
        "detail": action.detail,
    }


@router.get("/health")
async def health():
    return {"status": "ok", "active_sessions": session_manager.active_count}

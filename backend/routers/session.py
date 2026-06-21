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
from annotations import Annotation, parse_annotations, get_watched_vars
from diff import compute_diff
from memory_walker import MemoryWalker
from state import (
    get_debugger, store_debugger, pop_debugger,
    get_compiler, store_compiler, pop_compiler,
    get_walker, store_walker, pop_walker,
    get_breakpoints, store_breakpoints, pop_breakpoints,
    get_annotations, store_annotations, pop_annotations,
    get_prev_structures, store_prev_structures, pop_prev_structures,
    cleanup_session,
)

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

@router.post("/session")
async def create_session():
    """Create a new session. Returns a session_id."""
    session_id = session_manager.create()
    store_debugger(session_id, LLDBController())
    store_compiler(session_id, CodeCompiler())
    store_breakpoints(session_id, set())
    store_annotations(session_id, [])
    store_prev_structures(session_id, [])
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
            top_var=item.get("top_var", ""),
            front_var=item.get("front_var", ""),
            rear_var=item.get("rear_var", ""),
            mode=item.get("mode", ""),
            watched_vars=item.get("watched_vars", []),
        )
        # Avoid duplicates: skip if same name already parsed from code
        if not any(a.name == ann.name and a.struct_type == ann.struct_type for a in code_annotations):
            code_annotations.append(ann)

    store_annotations(session_id, code_annotations)

    # Create MemoryWalker (wraps the debugger's send capability)
    debugger = get_debugger(session_id)
    store_walker(session_id, MemoryWalker(debugger._send_cmd))

    # Compile
    compiler = get_compiler(session_id)
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
    store_breakpoints(session_id, bp_lines)

    # §v0.8: store user-selected visualization targets
    raw_selected = body.get("selected_vars")
    if isinstance(raw_selected, list):
        session.selected_vars = [str(v) for v in raw_selected]
    else:
        session.selected_vars = None  # None = select all (auto-discover)

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
            annotations=code_annotations,
            walker=get_walker(session_id),
            selected_vars=session.selected_vars,
        )
        store_prev_structures(session_id, snapshot.get("heap_structures", []))
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

    debugger = get_debugger(session_id)
    if not debugger or not debugger.is_running():
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

        annotations = get_annotations(session_id)
        walker = get_walker(session_id)
        snapshot = build_snapshot(
            session.step_number, debugger_state, session.source_file,
            annotations=annotations,
            walker=walker,
        )

        # Compute diff
        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = get_prev_structures(session_id)
        diff_actions = compute_diff(prev_structures, curr_structures, watched_vars=get_watched_vars(annotations))
        store_prev_structures(session_id, curr_structures)

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

    # Compute diff for animations on back
    curr = session.history[-1].get("heap_structures", [])
    anns = get_annotations(session_id)
    diffs = compute_diff(get_prev_structures(session_id), curr, watched_vars=get_watched_vars(anns))
    store_prev_structures(session_id, curr)

    return {
        "type": "snapshot",
        "payload": session.history[-1],
        "diff_actions": [_action_to_dict(a) for a in diffs],
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

    # Compute diff for animations on forward
    curr = snapshot.get("heap_structures", [])
    anns = get_annotations(session_id)
    diffs = compute_diff(get_prev_structures(session_id), curr, watched_vars=get_watched_vars(anns))
    store_prev_structures(session_id, curr)

    return {
        "type": "snapshot",
        "payload": snapshot,
        "diff_actions": [_action_to_dict(a) for a in diffs],
    }


@router.post("/session/{session_id}/run-to")
async def run_to(session_id: str, body: dict | None = None):
    """Run until a breakpoint is hit or the program terminates."""
    session = session_manager.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debugger = get_debugger(session_id)
    if not debugger or not debugger.is_running():
        return {
            "type": "terminated",
            "payload": {"message": "Program has already terminated."},
        }

    try:
        debugger_state = debugger.run_to_breakpoint()
        session.step_number += 1

        annotations = get_annotations(session_id)
        walker = get_walker(session_id)
        snapshot = build_snapshot(
            session.step_number, debugger_state, session.source_file,
            annotations=annotations, walker=walker,
        )

        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = get_prev_structures(session_id)
        diff_actions = compute_diff(prev_structures, curr_structures, watched_vars=get_watched_vars(annotations))
        store_prev_structures(session_id, curr_structures)

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

    debugger = get_debugger(session_id)
    debugger.terminate()

    # Re-create debugger
    store_debugger(session_id, LLDBController())
    debugger = get_debugger(session_id)

    session.step_number = 0
    session.history.clear()
    session.future.clear()

    # Recompile
    compiler = get_compiler(session_id)
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
        for line in get_breakpoints(session_id):
            debugger.set_breakpoint(line)

        state = debugger.get_state()
        session.step_number = 1

        annotations = get_annotations(session_id)
        walker = get_walker(session_id)
        snapshot = build_snapshot(
            1, state, session.source_file,
            annotations=annotations, walker=walker,
        )
        store_prev_structures(session_id, snapshot.get("heap_structures", []))
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
    debugger = pop_debugger(session_id)
    if debugger:
        debugger.terminate()

    pop_compiler(session_id)
    pop_walker(session_id)
    pop_breakpoints(session_id)
    pop_annotations(session_id)
    pop_prev_structures(session_id)

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

    debugger = get_debugger(session_id)
    debugger.set_breakpoint(line)

    bp_set = get_breakpoints(session_id)
    bp_set.add(line)
    store_breakpoints(session_id, bp_set)

    return {"status": "ok", "line": line}


@router.post("/session/{session_id}/remove-breakpoint")
async def remove_breakpoint(session_id: str, body: dict):
    """Remove a breakpoint at a given line."""
    line = body.get("line")
    if line is None:
        raise HTTPException(status_code=400, detail="Missing 'line' in request body")

    bp_set = get_breakpoints(session_id)
    bp_set.discard(line)

    debugger = get_debugger(session_id)
    if debugger:
        debugger.remove_breakpoint(line)

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

    debugger = get_debugger(session_id)
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

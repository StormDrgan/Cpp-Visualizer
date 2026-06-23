"""WebSocket router — persistent connection for real-time debugger communication.

Replaces HTTP request-response cycles with a single persistent WebSocket
per session. Both the HTTP router (session.py) and this WS router share
the same backend/state.py session state.
"""

from __future__ import annotations
import os
import shutil

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from compiler import CodeCompiler
from config import TEMP_ROOT
from debugger import LLDBController
from session_manager import session_manager
from snapshot import build_snapshot
from annotations import Annotation, parse_annotations, get_show_vars
from diff import compute_diff
from memory_walker import MemoryWalker
from state import (
    get_debugger, store_debugger, pop_debugger,
    get_compiler, store_compiler, pop_compiler,
    get_walker, store_walker, pop_walker,
    get_breakpoints, store_breakpoints, pop_breakpoints,
    get_annotations, store_annotations, pop_annotations,
    get_prev_structures, store_prev_structures, pop_prev_structures,
    register_ws, unregister_ws,
    cleanup_session,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    """Persistent WebSocket for a single debugger session.

    Messages from client: {"type": "...", "payload": {...}}
    Messages from server: {"type": "...", "payload": {...}, "diff_actions": [...]}
    """
    await websocket.accept()
    register_ws(session_id, websocket)

    try:
        while True:
            msg = await websocket.receive_json()
            await _dispatch(session_id, websocket, msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        unregister_ws(session_id)


# ---------------------------------------------------------------------------
# Message dispatch
# ---------------------------------------------------------------------------

async def _dispatch(session_id: str, ws: WebSocket, msg: dict) -> None:
    """Route an incoming message to the appropriate handler."""
    msg_type = msg.get("type", "")
    payload = msg.get("payload", {})

    try:
        if msg_type == "load":
            await _handle_load(session_id, ws, payload)
        elif msg_type == "step":
            await _handle_step(session_id, ws, payload)
        elif msg_type == "back":
            await _handle_back(session_id, ws, payload)
        elif msg_type == "forward":
            await _handle_forward(session_id, ws, payload)
        elif msg_type == "run_to":
            await _handle_run_to(session_id, ws, payload)
        elif msg_type == "reset":
            await _handle_reset(session_id, ws, payload)
        elif msg_type == "set_breakpoint":
            await _handle_set_breakpoint(session_id, ws, payload)
        elif msg_type == "remove_breakpoint":
            await _handle_remove_breakpoint(session_id, ws, payload)
        elif msg_type == "eval":
            await _handle_eval(session_id, ws, payload)
        else:
            await ws.send_json({"type": "error", "payload": {"message": f"Unknown message type: {msg_type}"}})
    except Exception as e:
        await ws.send_json({"type": "error", "payload": {"message": str(e)}})


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------

async def _handle_load(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Load source code, compile, start debugger, return first snapshot."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    code = payload.get("code", "")
    if not code.strip():
        await ws.send_json({"type": "error", "payload": {"message": "No source code provided"}})
        return

    session.source_code = code
    session.step_number = 0
    session.history.clear()
    session.future.clear()

    # Parse annotations
    code_annotations = parse_annotations(code)
    explicit = payload.get("annotations", [])

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
            show_vars=item.get("show_vars", []),
        )
        if not any(a.name == ann.name and a.struct_type == ann.struct_type for a in code_annotations):
            code_annotations.append(ann)

    store_annotations(session_id, code_annotations)

    # Create walker
    debugger = get_debugger(session_id)
    store_walker(session_id, MemoryWalker(debugger._send_cmd))

    # Compile
    compiler = get_compiler(session_id)
    result = compiler.compile(code, session_id)

    if not result.success:
        await ws.send_json({
            "type": "compile_error",
            "payload": {"errors": result.errors},
        })
        return

    session.binary_path = result.binary_path
    session.source_file = "main.cpp"

    bp_lines = set(payload.get("breakpoints", []))
    store_breakpoints(session_id, bp_lines)

    # §v0.8: store user-selected visualization targets
    raw_selected = payload.get("selected_vars")
    if isinstance(raw_selected, list):
        session.selected_vars = [str(v) for v in raw_selected]
    else:
        session.selected_vars = None  # None = select all (auto-discover)

    try:
        debugger.start(result.binary_path, session.source_file)

        for line in bp_lines:
            debugger.set_breakpoint(line)

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

        await ws.send_json({
            "type": "snapshot",
            "payload": snapshot,
        })

    except RuntimeError as e:
        await ws.send_json({
            "type": "error",
            "payload": {"message": str(e)},
        })


async def _handle_step(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Step the debugger and return new snapshot with diff."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    debugger = get_debugger(session_id)
    if not debugger or not debugger.is_running():
        await ws.send_json({
            "type": "terminated",
            "payload": {"message": "Program has already terminated. Reset to run again."},
        })
        return

    mode = payload.get("mode", "step_over")

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
            annotations=annotations, walker=walker,
            selected_vars=session.selected_vars,
        )

        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = get_prev_structures(session_id)
        diff_actions = compute_diff(prev_structures, curr_structures, show_vars=get_show_vars(annotations))
        store_prev_structures(session_id, curr_structures)

        session.history.append(snapshot)
        session.future.clear()

        session_manager.start_cleanup_timer(session_id)

        await ws.send_json({
            "type": "snapshot",
            "payload": snapshot,
            "diff_actions": [_action_to_dict(a) for a in diff_actions],
        })

    except Exception as e:
        await ws.send_json({
            "type": "error",
            "payload": {"message": str(e)},
        })


async def _handle_back(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Step backward through history."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    steps = payload.get("steps", 1)

    if len(session.history) <= 1:
        await ws.send_json({
            "type": "snapshot",
            "payload": session.history[-1] if session.history else None,
        })
        return

    for _ in range(steps):
        if len(session.history) > 1:
            current = session.history.pop()
            session.future.append(current)

    session_manager.start_cleanup_timer(session_id)

    # Compute diff for animations on back
    curr = session.history[-1].get("heap_structures", [])
    anns = get_annotations(session_id)
    diffs = compute_diff(get_prev_structures(session_id), curr, show_vars=get_show_vars(anns))
    store_prev_structures(session_id, curr)

    await ws.send_json({
        "type": "snapshot",
        "payload": session.history[-1],
        "diff_actions": [_action_to_dict(a) for a in diffs],
    })


async def _handle_forward(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Step forward (redo) through future stack."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    if not session.future:
        await ws.send_json({
            "type": "snapshot",
            "payload": session.history[-1] if session.history else None,
        })
        return

    snapshot = session.future.pop()
    session.history.append(snapshot)

    session_manager.start_cleanup_timer(session_id)

    # Compute diff for animations on forward
    curr = snapshot.get("heap_structures", [])
    anns = get_annotations(session_id)
    diffs = compute_diff(get_prev_structures(session_id), curr, show_vars=get_show_vars(anns))
    store_prev_structures(session_id, curr)

    await ws.send_json({
        "type": "snapshot",
        "payload": snapshot,
        "diff_actions": [_action_to_dict(a) for a in diffs],
    })


async def _handle_run_to(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Run until breakpoint or termination."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    debugger = get_debugger(session_id)
    if not debugger or not debugger.is_running():
        await ws.send_json({
            "type": "terminated",
            "payload": {"message": "Program has already terminated."},
        })
        return

    try:
        debugger_state = debugger.run_to_breakpoint()
        session.step_number += 1

        annotations = get_annotations(session_id)
        walker = get_walker(session_id)
        snapshot = build_snapshot(
            session.step_number, debugger_state, session.source_file,
            annotations=annotations, walker=walker,
            selected_vars=session.selected_vars,
        )

        curr_structures = snapshot.get("heap_structures", [])
        prev_structures = get_prev_structures(session_id)
        diff_actions = compute_diff(prev_structures, curr_structures, show_vars=get_show_vars(annotations))
        store_prev_structures(session_id, curr_structures)

        session.history.append(snapshot)
        session.future.clear()

        session_manager.start_cleanup_timer(session_id)

        await ws.send_json({
            "type": "snapshot",
            "payload": snapshot,
            "diff_actions": [_action_to_dict(a) for a in diff_actions],
        })

    except Exception as e:
        await ws.send_json({
            "type": "error",
            "payload": {"message": str(e)},
        })


async def _handle_reset(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Reset the session — kill debugger, recompile, restart."""
    session = session_manager.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "payload": {"message": "Session not found"}})
        return

    debugger = get_debugger(session_id)
    debugger.terminate()

    store_debugger(session_id, LLDBController())
    debugger = get_debugger(session_id)

    session.step_number = 0
    session.history.clear()
    session.future.clear()

    compiler = get_compiler(session_id)
    result = compiler.compile(session.source_code, session_id)

    if not result.success:
        await ws.send_json({
            "type": "compile_error",
            "payload": {"errors": result.errors},
        })
        return

    session.binary_path = result.binary_path

    try:
        debugger.start(result.binary_path, session.source_file)

        for line in get_breakpoints(session_id):
            debugger.set_breakpoint(line)

        state = debugger.get_state()
        session.step_number = 1

        annotations = get_annotations(session_id)
        walker = get_walker(session_id)
        snapshot = build_snapshot(
            1, state, session.source_file,
            annotations=annotations, walker=walker,
            selected_vars=session.selected_vars,
        )
        store_prev_structures(session_id, snapshot.get("heap_structures", []))
        session.history.append(snapshot)

        await ws.send_json({
            "type": "snapshot",
            "payload": snapshot,
        })

    except RuntimeError as e:
        await ws.send_json({
            "type": "error",
            "payload": {"message": str(e)},
        })


async def _handle_set_breakpoint(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Set a breakpoint."""
    line = payload.get("line")
    if line is None:
        await ws.send_json({"type": "error", "payload": {"message": "Missing line"}})
        return

    debugger = get_debugger(session_id)
    if debugger:
        debugger.set_breakpoint(line)

    bp_set = get_breakpoints(session_id)
    bp_set.add(line)
    store_breakpoints(session_id, bp_set)

    await ws.send_json({"type": "breakpoint_set", "payload": {"line": line}})


async def _handle_remove_breakpoint(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Remove a breakpoint."""
    line = payload.get("line")
    if line is None:
        await ws.send_json({"type": "error", "payload": {"message": "Missing line"}})
        return

    bp_set = get_breakpoints(session_id)
    bp_set.discard(line)

    debugger = get_debugger(session_id)
    if debugger:
        debugger.remove_breakpoint(line)

    await ws.send_json({"type": "breakpoint_removed", "payload": {"line": line}})


async def _handle_eval(session_id: str, ws: WebSocket, payload: dict) -> None:
    """Evaluate an expression."""
    expression = payload.get("expression", "")
    if not expression:
        await ws.send_json({"type": "error", "payload": {"message": "Missing expression"}})
        return

    debugger = get_debugger(session_id)
    if debugger:
        result = debugger.evaluate(expression)
        await ws.send_json({"type": "eval_result", "payload": {"expression": expression, "value": result}})
    else:
        await ws.send_json({"type": "eval_result", "payload": {"expression": expression, "value": ""}})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _action_to_dict(action) -> dict:
    """Convert a DiffAction to a JSON-safe dict."""
    return {
        "action": action.action,
        "structure_name": action.structure_name,
        "node_addr": action.node_addr,
        "detail": action.detail,
    }

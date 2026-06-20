#!/usr/bin/env python3
"""LLDB Bridge — runs inside Xcode's Python 3.9 with LLDB bindings.

Communicates via stdin/stdout using JSON lines. Reads a command, executes it
using the LLDB Python API, writes a JSON response. Loops until 'terminate'.

Usage:
    /Applications/Xcode.app/.../python3.9 lldb_bridge.py
"""

import json
import sys
import os

# Ensure LLDB Python bindings are importable
LLDB_PYTHON = "/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Versions/A/Resources/Python"
if LLDB_PYTHON not in sys.path:
    sys.path.insert(0, LLDB_PYTHON)

import lldb


def log(msg: str) -> None:
    """Write debug log to stderr (never to stdout, which is the JSON channel)."""
    print(f"[bridge] {msg}", file=sys.stderr, flush=True)


def send_response(data: dict) -> None:
    """Write a JSON response to stdout followed by a newline."""
    line = json.dumps(data, default=str)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def handle_command(cmd: dict, ctx: dict) -> None:
    """Dispatch a command to the appropriate handler."""
    name = cmd.get("cmd", "")

    try:
        if name == "start":
            handle_start(cmd, ctx)
        elif name == "step_over":
            handle_step(ctx, "over")
        elif name == "step_into":
            handle_step(ctx, "into")
        elif name == "step_out":
            handle_step(ctx, "out")
        elif name == "continue":
            handle_continue(ctx)
        elif name == "get_state":
            handle_get_state(ctx)
        elif name == "evaluate":
            handle_evaluate(cmd, ctx)
        elif name == "set_breakpoint":
            handle_set_breakpoint(cmd, ctx)
        elif name == "walk_linked_list":
            handle_walk_linked_list(cmd, ctx)
        elif name == "terminate":
            handle_terminate(ctx)
            send_response({"ok": True, "result": "terminated"})
        else:
            send_response({"ok": False, "error": f"Unknown command: {name}"})
    except Exception as e:
        import traceback
        log(traceback.format_exc())
        send_response({"ok": False, "error": str(e)})


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

def handle_start(cmd: dict, ctx: dict) -> None:
    """Start a new debug session."""
    binary_path = cmd.get("binary", "")
    source_file = cmd.get("source_file", "main.cpp")
    bp_lines = cmd.get("breakpoints", [])

    if not binary_path or not os.path.exists(binary_path):
        send_response({"ok": False, "error": f"Binary not found: {binary_path}"})
        return

    # Clean up any existing session
    if ctx.get("debugger"):
        lldb.SBDebugger.Destroy(ctx["debugger"])

    # Create debugger (synchronous mode for simpler control)
    debugger = lldb.SBDebugger.Create()
    debugger.SetAsync(False)

    # Create target
    error = lldb.SBError()
    target = debugger.CreateTarget(binary_path, None, None, False, error)
    if not target or error.Fail():
        lldb.SBDebugger.Destroy(debugger)
        send_response({"ok": False, "error": f"Failed to create target: {error.GetCString()}"})
        return

    # Set breakpoints at specified lines
    for line in bp_lines:
        target.BreakpointCreateByLocation(source_file, int(line))

    # We rely on the breakpoint at 'main' to stop first.
    # Some binaries have main name-mangled; try both.
    main_bp = target.BreakpointCreateByName("main")
    if not main_bp or main_bp.GetNumLocations() == 0:
        target.BreakpointCreateByRegex("^main$")

    # Launch
    launch_info = lldb.SBLaunchInfo(None)
    launch_info.SetLaunchFlags(lldb.eLaunchFlagStopAtEntry)
    error = lldb.SBError()
    process = target.Launch(launch_info, error)
    if not process or error.Fail():
        lldb.SBDebugger.Destroy(debugger)
        send_response({"ok": False, "error": f"Launch failed: {error.GetCString()}"})
        return

    # Wait for stop (should be at entry point)
    _wait_for_stop(process)

    # Now continue to the main breakpoint
    process.Continue()
    _wait_for_stop(process)

    state = process.GetState()
    if state == lldb.eStateExited:
        ctx.update(debugger=debugger, target=target, process=process,
                   source_file=source_file, alive=False)
        send_response({"ok": True, "result": _build_state(process, source_file, is_terminated=True)})
        return

    ctx.update(debugger=debugger, target=target, process=process,
               source_file=source_file, alive=True)
    send_response({"ok": True, "result": _build_state(process, source_file)})


def handle_step(ctx: dict, mode: str) -> None:
    """Step over / into / out."""
    process = ctx.get("process")
    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    if mode == "into":
        thread.StepInto()
    elif mode == "out":
        thread.StepOut()
    else:
        thread.StepOver()

    _wait_for_stop(process)

    st = process.GetState()
    if st == lldb.eStateExited:
        ctx["alive"] = False
        send_response({"ok": True, "result": _build_state(process, ctx["source_file"], is_terminated=True)})
        return

    send_response({"ok": True, "result": _build_state(process, ctx["source_file"])})


def handle_continue(ctx: dict) -> None:
    """Continue until breakpoint or exit."""
    process = ctx.get("process")
    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    process.Continue()
    _wait_for_stop(process)

    st = process.GetState()
    if st == lldb.eStateExited:
        ctx["alive"] = False
        send_response({"ok": True, "result": _build_state(process, ctx["source_file"], is_terminated=True)})
        return

    send_response({"ok": True, "result": _build_state(process, ctx["source_file"])})


def handle_get_state(ctx: dict) -> None:
    """Return current debugger state."""
    process = ctx.get("process")
    source_file = ctx.get("source_file", "")
    if not process:
        send_response({"ok": True, "result": _empty_state(source_file, is_terminated=True)})
        return

    st = process.GetState()
    is_terminated = st == lldb.eStateExited
    send_response({"ok": True, "result": _build_state(process, source_file, is_terminated=is_terminated)})


def handle_evaluate(cmd: dict, ctx: dict) -> None:
    """Evaluate an expression in the current frame."""
    expr = cmd.get("expression", "")
    process = ctx.get("process")

    if not process:
        send_response({"ok": False, "error": "No process"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    result = frame.EvaluateExpression(expr)
    value = str(result.GetValue() or result.GetError().GetCString() or "")
    send_response({"ok": True, "result": {"expression": expr, "value": value}})


def handle_set_breakpoint(cmd: dict, ctx: dict) -> None:
    """Set a breakpoint at a line."""
    line = int(cmd.get("line", 0))
    target = ctx.get("target")
    source_file = ctx.get("source_file", "")

    if not target:
        send_response({"ok": False, "error": "No target"})
        return

    bp = target.BreakpointCreateByLocation(source_file, line)
    if bp:
        bp.SetEnabled(True)
        send_response({"ok": True, "result": {"line": line, "id": bp.GetID()}})
    else:
        send_response({"ok": False, "error": f"Failed to set breakpoint at line {line}"})


def handle_walk_linked_list(cmd: dict, ctx: dict) -> None:
    """Walk a linked list starting from root_var, following next_field.

    Uses LLDB's type system to read struct fields properly.
    """
    root_var = cmd.get("root_var", "")
    next_field = cmd.get("next_field", "next")
    process = ctx.get("process")

    if not process or not ctx.get("alive"):
        send_response({"ok": False, "error": "No process running"})
        return

    thread = _get_thread(process)
    if not thread:
        send_response({"ok": False, "error": "No thread"})
        return

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        send_response({"ok": False, "error": "No valid frame"})
        return

    if not root_var:
        send_response({"ok": False, "error": "No root_var provided"})
        return

    try:
        # Evaluate root variable to get address AND type
        root_val = frame.EvaluateExpression(root_var)
        if not root_val or root_val.GetError().Fail():
            send_response({"ok": False, "error": f"Failed to evaluate {root_var}"})
            return

        root_addr = str(root_val.GetValue() or "0x0")
        if _is_null(root_addr):
            send_response({"ok": True, "result": {"nodes": [], "cycle_detected": False}})
            return

        # Discover struct type from the variable type
        type_name = str(root_val.GetTypeName() or "")  # e.g., "ListNode *"
        struct_type = type_name.replace(" *", "").replace("*", "").strip()

        if not struct_type:
            send_response({"ok": False, "error": "Could not determine struct type from variable"})
            return

        # Walk the chain with proper types
        nodes, has_cycle = _walk_chain_typed(frame, root_addr, struct_type, next_field)
        send_response({"ok": True, "result": {"nodes": nodes, "cycle_detected": has_cycle}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _is_null(addr: str) -> bool:
    """Check if an address string represents a null pointer."""
    if not addr:
        return True
    try:
        return int(addr, 16) == 0
    except ValueError:
        return addr in ("nullptr", "NULL", "0x0", "0")


def _walk_chain_typed(frame, start_addr: str, struct_type: str, next_field: str) -> tuple[list[dict], bool]:
    """Walk a linked chain using typed struct field access."""
    nodes = []
    visited = {}
    addr = start_addr
    step = 0
    max_steps = 200

    while not _is_null(addr) and step < max_steps:
        if addr in visited:
            return nodes, True

        visited[addr] = len(nodes)

        fields = {}
        label = f"{struct_type}@{addr[-4:]}"

        # Read ALL fields of the struct using typed expressions
        # Read 'val' field (first integer field, common in ListNode)
        val_expr = f"(({struct_type}*){addr})->val"
        val_result = frame.EvaluateExpression(val_expr)
        if val_result and val_result.GetError().Success():
            val_str = str(val_result.GetValue() or "")
            fields["val"] = val_str
            label = f"{struct_type}({val_str})"

        # Read the next pointer field
        next_expr = f"(({struct_type}*){addr})->{next_field}"
        next_result = frame.EvaluateExpression(next_expr)
        if next_result and next_result.GetError().Success():
            next_addr = str(next_result.GetValue() or "0x0")
            fields[next_field] = next_addr
        else:
            # Try reading as raw pointer at offset to discover fields
            raw_ptr = frame.EvaluateExpression(f"*((unsigned long long*)({addr} + 8))")
            if raw_ptr and raw_ptr.GetError().Success():
                fields[next_field] = str(raw_ptr.GetValue() or "0x0")

        nodes.append({
            "addr": addr,
            "label": label,
            "fields": fields,
        })

        # Move to next node
        new_addr = fields.get(next_field, "0x0")
        if new_addr == addr or _is_null(new_addr):
            break
        addr = new_addr
        step += 1

    return nodes, False


def handle_terminate(ctx: dict) -> None:
    """Clean up debugger resources."""
    process = ctx.get("process")
    debugger = ctx.get("debugger")

    if process and process.IsValid():
        process.Kill()

    if debugger:
        lldb.SBDebugger.Destroy(debugger)

    ctx.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _wait_for_stop(process: lldb.SBProcess, timeout: float = 2.0) -> None:
    """Poll until the process stops or timeout."""
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = process.GetState()
        if state in (lldb.eStateStopped, lldb.eStateExited, lldb.eStateCrashed):
            return
        time.sleep(0.01)


def _get_thread(process: lldb.SBProcess):
    """Get the first valid thread."""
    if not process or not process.IsValid():
        return None
    thread = process.GetThreadAtIndex(0)
    if not thread or not thread.IsValid():
        return None
    return thread


def _build_state(process: lldb.SBProcess, source_file: str, is_terminated: bool = False) -> dict:
    """Build a state snapshot dict from the current process."""
    if is_terminated:
        exit_code = process.GetExitStatus() if process else 0
        return {
            "source_line": 0,
            "file": source_file,
            "current_function": "",
            "locals": [],
            "call_stack": [],
            "is_terminated": True,
            "exit_code": exit_code,
        }

    thread = _get_thread(process)
    if not thread:
        return _empty_state(source_file, is_terminated=True)

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        return _empty_state(source_file, is_terminated=True)

    line_entry = frame.GetLineEntry()
    source_line = line_entry.GetLine() if line_entry.IsValid() else 0
    file_spec = line_entry.GetFileSpec() if line_entry.IsValid() else None
    file = str(file_spec.GetFilename()) if file_spec and file_spec.GetFilename() else source_file
    func_name = str(frame.GetFunctionName() or "")

    # Locals (filter out std:: namespace pollution)
    locals_list = []
    values = frame.GetVariables(True, True, False, False)  # no statics
    for i in range(values.GetSize()):
        val = values.GetValueAtIndex(i)
        if not val:
            continue
        name = val.GetName()
        if not name:
            continue
        # Skip std:: namespace variables
        if name.startswith("std::"):
            continue
        type_name = str(val.GetTypeName() or "")
        summary = val.GetSummary()
        display_value = str(summary).strip('"') if summary else str(val.GetValue() or "").strip('"')
        is_ptr = type_name.endswith("*") or type_name.endswith(" *")
        locals_list.append({
            "name": str(name),
            "type": type_name,
            "value": display_value,
            "is_pointer": is_ptr,
        })

    # Call stack
    call_stack = []
    for i in range(thread.GetNumFrames()):
        f = thread.GetFrameAtIndex(i)
        if not f or not f.IsValid():
            continue
        le = f.GetLineEntry()
        fs = le.GetFileSpec() if le.IsValid() else None
        call_stack.append({
            "function": str(f.GetFunctionName() or ""),
            "line": le.GetLine() if le.IsValid() else 0,
            "file": str(fs.GetFilename()) if fs and fs.GetFilename() else source_file,
        })

    return {
        "source_line": source_line,
        "file": file,
        "current_function": func_name,
        "locals": locals_list,
        "call_stack": call_stack,
        "is_terminated": False,
        "exit_code": None,
    }


def _empty_state(source_file: str, is_terminated: bool = False) -> dict:
    return {
        "source_line": 0,
        "file": source_file,
        "current_function": "",
        "locals": [],
        "call_stack": [],
        "is_terminated": is_terminated,
        "exit_code": 0,
    }


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    """Main bridge loop: read JSON command, execute, write JSON response."""
    log("LLDB bridge started")

    ctx: dict = {}  # holds debugger, target, process, source_file, alive

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            cmd = json.loads(line)
        except json.JSONDecodeError as e:
            log(f"Invalid JSON: {e}")
            send_response({"ok": False, "error": f"Invalid JSON: {e}"})
            continue

        handle_command(cmd, ctx)

        # If terminate was called, exit the loop
        if cmd.get("cmd") == "terminate":
            break

    log("LLDB bridge exiting")


if __name__ == "__main__":
    main()

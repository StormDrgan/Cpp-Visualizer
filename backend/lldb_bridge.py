#!/usr/bin/env python3
"""LLDB Bridge — runs inside Xcode's Python 3.9 with LLDB bindings.

Communicates via stdin/stdout using JSON lines. Reads a command, executes it
using the LLDB Python API, writes a JSON response. Loops until 'terminate'.

Usage:
    /Applications/Xcode.app/.../python3.9 lldb_bridge.py
"""

from __future__ import annotations
import json
import sys
import os
import tempfile

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
        elif name == "remove_breakpoint":
            handle_remove_breakpoint(cmd, ctx)
        elif name == "walk_linked_list":
            handle_walk_linked_list(cmd, ctx)
        elif name == "walk_binary_tree":
            handle_walk_binary_tree(cmd, ctx)
        elif name == "walk_array":
            handle_walk_array(cmd, ctx)
        elif name == "walk_graph":
            handle_walk_graph(cmd, ctx)
        elif name == "walk_hashmap":
            handle_walk_hashmap(cmd, ctx)
        elif name == "walk_b_tree":
            handle_walk_b_tree(cmd, ctx)
        elif name == "inspect_type":
            handle_inspect_type(cmd, ctx)
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

    # Redirect debugged process stdout to a temp file so we can read it back
    stdout_fd, stdout_path = tempfile.mkstemp(prefix="cppviz_stdout_", suffix=".txt")
    os.close(stdout_fd)  # close the fd; LLDB will open the file itself
    launch_info = lldb.SBLaunchInfo(None)
    launch_info.SetLaunchFlags(lldb.eLaunchFlagStopAtEntry)
    launch_info.AddOpenFileAction(1, stdout_path, False, True)  # fd 1 = stdout, write mode
    error = lldb.SBError()
    process = target.Launch(launch_info, error)
    if not process or error.Fail():
        lldb.SBDebugger.Destroy(debugger)
        try: os.unlink(stdout_path)
        except OSError: pass
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
                   source_file=source_file, alive=False, stdout_path=stdout_path)
        send_response({"ok": True, "result": _build_state(process, source_file, stdout_path, is_terminated=True)})
        return

    ctx.update(debugger=debugger, target=target, process=process,
               source_file=source_file, alive=True, stdout_path=stdout_path)
    send_response({"ok": True, "result": _build_state(process, source_file, stdout_path)})


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
        send_response({"ok": True, "result": _build_state(process, ctx["source_file"], ctx.get("stdout_path"), is_terminated=True)})
        return

    send_response({"ok": True, "result": _build_state(process, ctx["source_file"], ctx.get("stdout_path"))})


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
        send_response({"ok": True, "result": _build_state(process, ctx["source_file"], ctx.get("stdout_path"), is_terminated=True)})
        return

    send_response({"ok": True, "result": _build_state(process, ctx["source_file"], ctx.get("stdout_path"))})


def handle_get_state(ctx: dict) -> None:
    """Return current debugger state."""
    process = ctx.get("process")
    source_file = ctx.get("source_file", "")
    stdout_path = ctx.get("stdout_path")
    if not process:
        send_response({"ok": True, "result": _empty_state(source_file, is_terminated=True, stdout=_read_stdout(stdout_path))})
        return

    st = process.GetState()
    is_terminated = st == lldb.eStateExited
    send_response({"ok": True, "result": _build_state(process, source_file, stdout_path, is_terminated=is_terminated)})


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


def handle_remove_breakpoint(cmd: dict, ctx: dict) -> None:
    """Remove (delete) breakpoints at a given line in the source file."""
    line = int(cmd.get("line", 0))
    target = ctx.get("target")
    source_file = ctx.get("source_file", "")

    if not target:
        send_response({"ok": False, "error": "No target"})
        return

    removed = 0
    bp_ids_to_delete = []

    for i in range(target.GetNumBreakpoints()):
        bp = target.GetBreakpointAtIndex(i)
        for j in range(bp.GetNumLocations()):
            loc = bp.GetLocationAtIndex(j)
            addr = loc.GetAddress()
            if not addr or not addr.IsValid():
                continue
            le = addr.GetLineEntry()
            if not le or not le.IsValid():
                continue
            if le.GetLine() == line:
                bp_file = le.GetFileSpec()
                if bp_file and bp_file.GetFilename() and source_file:
                    if bp_file.GetFilename() == source_file:
                        bp_ids_to_delete.append(bp.GetID())
                        break
                else:
                    bp_ids_to_delete.append(bp.GetID())
                    break

    for bp_id in bp_ids_to_delete:
        target.BreakpointDelete(bp_id)
        removed += 1

    send_response({"ok": True, "result": {"line": line, "removed": removed}})

def handle_terminate(ctx: dict) -> None:
    """Clean up debugger resources."""
    process = ctx.get("process")
    debugger = ctx.get("debugger")
    stdout_path = ctx.get("stdout_path")

    if process and process.IsValid():
        process.Kill()

    if debugger:
        lldb.SBDebugger.Destroy(debugger)

    # Clean up the temp stdout capture file
    if stdout_path:
        try:
            os.unlink(stdout_path)
        except OSError:
            pass

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


def _build_state(process: lldb.SBProcess, source_file: str, stdout_path: str | None = None, is_terminated: bool = False) -> dict:
    """Build a state snapshot dict from the current process."""
    # Read accumulated stdout from the temp file (if available)
    stdout = ""
    if stdout_path:
        try:
            with open(stdout_path, "r") as f:
                stdout = f.read()
        except (OSError, UnicodeDecodeError):
            pass

    if is_terminated:
        exit_code = process.GetExitStatus() if process else 0
        return {
            "source_line": 0,
            "file": source_file,
            "current_function": "",
            "locals": [],
            "call_stack": [],
            "stdout": stdout,
            "is_terminated": True,
            "exit_code": exit_code,
        }

    thread = _get_thread(process)
    if not thread:
        return _empty_state(source_file, is_terminated=True, stdout=stdout)

    frame = thread.GetFrameAtIndex(0)
    if not frame or not frame.IsValid():
        return _empty_state(source_file, is_terminated=True, stdout=stdout)

    line_entry = frame.GetLineEntry()
    source_line = line_entry.GetLine() if line_entry.IsValid() else 0
    file_spec = line_entry.GetFileSpec() if line_entry.IsValid() else None
    file = str(file_spec.GetFilename()) if file_spec and file_spec.GetFilename() else source_file
    func_name = str(frame.GetFunctionName() or "")

    # Locals (filter out std:: namespace pollution)
    locals_list = []
    values = frame.GetVariables(True, True, False, True)  # in_scope_only=True: skip un-executed decls
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

        # v0.9 fix: skip variables whose declaration hasn't been fully
        # executed yet.  At the declaration line (with init), the var is
        # in scope but uninitialised — its pointer value is stack garbage.
        # _is_null_addr can't catch this because garbage is almost never 0x0.
        decl = val.GetDeclaration()
        if decl and decl.IsValid():
            decl_line = decl.GetLine()
            if decl_line > 0 and decl_line >= source_line:
                continue
        type_name = str(val.GetTypeName() or "")
        summary = val.GetSummary()
        raw_value = str(val.GetValue() or "").strip('"')
        display_value = str(summary).strip('"') if summary else raw_value
        is_ptr = type_name.endswith("*") or type_name.endswith(" *")

        # Try to dereference pointer to get the pointed-to value
        deref_type = None
        if is_ptr and not _is_null(raw_value):
            deref_val = val.Dereference()
            if deref_val and deref_val.IsValid():
                deref_type = str(deref_val.GetTypeName() or type_name.replace("*", "").strip())
                deref_summary = deref_val.GetSummary()
                if deref_summary:
                    # Show address + pointed-to value: "0x92b0 → summary"
                    deref_display = str(deref_summary).strip('"')
                else:
                    # Custom structs (e.g., ListNode) don't have LLDB formatters
                    # Build summary from child members; skip pointer fields
                    # (pointer relationships are shown on the canvas)
                    children_parts = []
                    num_children = deref_val.GetNumChildren()
                    for j in range(min(num_children, 20)):
                        child = deref_val.GetChildAtIndex(j)
                        if child:
                            cname = str(child.GetName() or "")
                            if cname:
                                child_type = str(child.GetTypeName() or "")
                                is_child_ptr = child_type.endswith("*") or child_type.endswith(" *")
                                if is_child_ptr:
                                    continue  # skip pointer — canvas shows the connection
                                cval = child.GetSummary() or child.GetValue() or ""
                                cval = str(cval).strip('"')
                                children_parts.append(f"{cname}={cval}")
                    if children_parts:
                        deref_display = f"{{{', '.join(children_parts)}}}"
                    else:
                        deref_display = ""
                # Format: "0x… → {val=1}" for pointers, showing both address and deref
                if deref_display:
                    display_value = f"{raw_value} → {deref_display}"
                else:
                    display_value = raw_value  # just the address if nothing to show
            else:
                # Dereference failed — just show raw address
                display_value = raw_value

        locals_list.append({
            "name": str(name),
            "type": type_name,
            "value": raw_value,
            "display_value": display_value,
            "is_pointer": is_ptr,
            "deref_type": deref_type,
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
        "stdout": stdout,
        "is_terminated": False,
        "exit_code": None,
    }


def _read_stdout(stdout_path: str | None) -> str:
    """Read accumulated stdout from the temp file."""
    if not stdout_path:
        return ""
    try:
        with open(stdout_path, "r") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return ""


def _empty_state(source_file: str, is_terminated: bool = False, stdout: str = "") -> dict:
    return {
        "source_line": 0,
        "file": source_file,
        "current_function": "",
        "locals": [],
        "call_stack": [],
        "stdout": stdout,
        "is_terminated": is_terminated,
        "exit_code": 0,
    }


# ---------------------------------------------------------------------------

# Import walk handlers (late import to avoid circular deps)
from lldb_walkers import (
    handle_walk_linked_list,
    handle_walk_binary_tree,
    handle_walk_array,
    handle_walk_graph,
    handle_walk_hashmap,
    handle_walk_b_tree,
    handle_inspect_type,
)

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

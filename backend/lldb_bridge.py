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


def handle_walk_binary_tree(cmd: dict, ctx: dict) -> None:
    """Walk a binary tree starting from root_var, following left_field and right_field.

    Uses BFS to collect all nodes and their parent-child relationships.
    """
    root_var = cmd.get("root_var", "")
    left_field = cmd.get("left_field", "left")
    right_field = cmd.get("right_field", "right")
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
        # Evaluate root variable to get address and type
        root_val = frame.EvaluateExpression(root_var)
        if not root_val or root_val.GetError().Fail():
            send_response({"ok": False, "error": f"Failed to evaluate {root_var}"})
            return

        root_addr = str(root_val.GetValue() or "0x0")
        if _is_null(root_addr):
            send_response({"ok": True, "result": {"nodes": [], "edges": []}})
            return

        # Discover struct type
        type_name = str(root_val.GetTypeName() or "")
        struct_type = type_name.replace(" *", "").replace("*", "").strip()

        if not struct_type:
            send_response({"ok": False, "error": "Could not determine struct type from variable"})
            return

        nodes, edges = _walk_tree_bfs(frame, root_addr, struct_type, left_field, right_field)
        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def handle_walk_array(cmd: dict, ctx: dict) -> None:
    """Walk a C++ array (stack or heap), reading each element by index.

    Supports both stack arrays (int arr[5]) and heap arrays (int* arr = new int[n]).
    The length_var can be a variable name or a literal integer.
    """
    var_name = cmd.get("var_name", "")
    length_var = cmd.get("length_var", "")
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

    if not var_name or not length_var:
        send_response({"ok": False, "error": "Missing var_name or length_var"})
        return

    try:
        # Resolve length: try evaluating as variable first, then as literal
        N = 0
        len_result = frame.EvaluateExpression(length_var)
        if len_result and len_result.GetError().Success():
            try:
                N = int(str(len_result.GetValue() or "0"))
            except ValueError:
                N = 0

        if N <= 0:
            # Try parsing length_var as a literal integer
            try:
                N = int(length_var)
            except ValueError:
                send_response({"ok": False, "error": f"Cannot resolve length: {length_var} (value={N})"})
                return

        # Cap array size
        max_elements = 500
        if N > max_elements:
            N = max_elements

        nodes = []
        for i in range(N):
            # Read element value
            elem_expr = f"{var_name}[{i}]"
            elem_result = frame.EvaluateExpression(elem_expr)
            if not elem_result or elem_result.GetError().Fail():
                # Try treating var_name as a pointer: *(var_name + i)
                elem_expr2 = f"*({var_name} + {i})"
                elem_result = frame.EvaluateExpression(elem_expr2)
                if not elem_result or elem_result.GetError().Fail():
                    continue

            val_str = str(elem_result.GetValue() or "")
            summary = elem_result.GetSummary()

            # Read element address for pointer matching
            addr_expr = f"&{var_name}[{i}]"
            addr_result = frame.EvaluateExpression(addr_expr)
            addr = "0x0"
            if addr_result and addr_result.GetError().Success():
                addr = str(addr_result.GetValue() or "0x0")
            else:
                # Fallback: pointer arithmetic for address
                addr_expr2 = f"({var_name} + {i})"
                addr_result2 = frame.EvaluateExpression(addr_expr2)
                if addr_result2 and addr_result2.GetError().Success():
                    addr = str(addr_result2.GetValue() or "0x0")
                else:
                    addr = f"arr[{i}]"  # synthetic address

            # Clean value display
            display = str(summary).strip('"') if summary else val_str

            nodes.append({
                "addr": addr,
                "label": display,
                "fields": {"index": str(i), "val": display},
            })

        send_response({"ok": True, "result": {"nodes": nodes}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _walk_tree_bfs(frame, root_addr: str, struct_type: str,
                   left_field: str, right_field: str) -> tuple[list[dict], list[dict]]:
    """BFS walk of a binary tree. Returns (nodes, edges)."""
    from collections import deque

    nodes = []
    edges = []
    visited = set()
    queue = deque()

    # Enqueue root with parent info
    queue.append((root_addr, -1))  # (addr, parent_index), -1 = no parent

    max_nodes = 200

    while queue and len(nodes) < max_nodes:
        addr, parent_idx = queue.popleft()

        if _is_null(addr) or addr in visited:
            continue

        visited.add(addr)
        node_idx = len(nodes)

        # Read fields via typed expression
        fields = {}
        label = f"{struct_type}@{addr[-4:]}"

        # Read 'val' field
        val_expr = f"(({struct_type}*){addr})->val"
        val_result = frame.EvaluateExpression(val_expr)
        if val_result and val_result.GetError().Success():
            val_str = str(val_result.GetValue() or "")
            fields["val"] = val_str
            label = f"{val_str}"

        # Read left child
        left_addr = "0x0"
        left_expr = f"(({struct_type}*){addr})->{left_field}"
        left_result = frame.EvaluateExpression(left_expr)
        if left_result and left_result.GetError().Success():
            left_addr = str(left_result.GetValue() or "0x0")
        fields[left_field] = left_addr

        # Read right child
        right_addr = "0x0"
        right_expr = f"(({struct_type}*){addr})->{right_field}"
        right_result = frame.EvaluateExpression(right_expr)
        if right_result and right_result.GetError().Success():
            right_addr = str(right_result.GetValue() or "0x0")
        fields[right_field] = right_addr

        nodes.append({
            "addr": addr,
            "label": label,
            "fields": fields,
        })

        # Record edge from parent
        if parent_idx >= 0:
            edges.append({
                "from_idx": parent_idx,
                "to_idx": node_idx,
            })

        # Enqueue children (null children are recorded as null sentinels for layout)
        if not _is_null(left_addr):
            queue.append((left_addr, node_idx))
        if not _is_null(right_addr):
            queue.append((right_addr, node_idx))

    return nodes, edges


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


def handle_walk_graph(cmd: dict, ctx: dict) -> None:
    """Walk a graph structure — adjacency matrix or adjacency list.

    Command: {
        "cmd": "walk_graph",
        "root_var": "mat" or "adj_list",
        "mode": "matrix" | "adjlist",
        "size_var": "n"  // variable holding vertex count
    }
    """
    root_var = cmd.get("root_var", "")
    mode = cmd.get("mode", "adjlist")
    size_var = cmd.get("size_var", "")
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
        # Resolve vertex count
        N = 0
        if size_var:
            size_result = frame.EvaluateExpression(size_var)
            if size_result and size_result.GetError().Success():
                try:
                    N = int(str(size_result.GetValue() or "0"))
                except ValueError:
                    N = 0

        if N <= 0:
            # Try to infer from array size
            N = 5  # default

        max_vertices = min(N, 30)

        if mode == "matrix":
            nodes, edges = _walk_adjacency_matrix(frame, root_var, max_vertices)
        else:
            nodes, edges = _walk_adjacency_list(frame, root_var, max_vertices)

        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _walk_adjacency_matrix(frame, mat_var: str, n: int) -> tuple[list[dict], list[dict]]:
    """Walk a 2D adjacency matrix."""
    nodes = []
    edges = []

    for i in range(n):
        nodes.append({
            "addr": f"vertex_{i}",
            "label": str(i),
            "fields": {"vertex_id": str(i)},
        })

    for i in range(n):
        for j in range(n):
            expr = f"{mat_var}[{i}][{j}]"
            result = frame.EvaluateExpression(expr)
            if result and result.GetError().Success():
                val_str = str(result.GetValue() or "0")
                try:
                    val = int(val_str)
                except ValueError:
                    val = 0
                if val != 0:
                    edges.append({
                        "from_idx": i,
                        "to_idx": j,
                    })

    return nodes, edges


def _walk_adjacency_list(frame, adj_var: str, n: int) -> tuple[list[dict], list[dict]]:
    """Walk an adjacency list (array of linked lists).

    Each adj[i] is a linked list where each node has fields like 'val' (vertex id)
    and 'next' (pointer to next edge node).
    """
    nodes = []
    edges = []

    for i in range(n):
        nodes.append({
            "addr": f"vertex_{i}",
            "label": str(i),
            "fields": {"vertex_id": str(i)},
        })

    for i in range(n):
        # Walk the linked list at adj[i]
        cur_addr_expr = f"{adj_var}[{i}]"
        cur_result = frame.EvaluateExpression(cur_addr_expr)
        if not cur_result or cur_result.GetError().Fail():
            continue

        cur_addr = str(cur_result.GetValue() or "0x0")
        if _is_null(cur_addr):
            continue

        # Walk the chain
        step = 0
        max_steps = 50
        visited = set()

        while not _is_null(cur_addr) and step < max_steps:
            if cur_addr in visited:
                break
            visited.add(cur_addr)

            # Read 'val' (neighbor vertex id)
            val_expr = f"*((int*)({cur_addr}))"
            val_result = frame.EvaluateExpression(val_expr)
            if val_result and val_result.GetError().Success():
                try:
                    neighbor = int(str(val_result.GetValue() or "-1"))
                except ValueError:
                    neighbor = -1
                if 0 <= neighbor < n:
                    edges.append({
                        "from_idx": i,
                        "to_idx": neighbor,
                    })

            # Move to next
            next_expr = f"*((unsigned long long*)({cur_addr} + 8))"
            next_result = frame.EvaluateExpression(next_expr)
            if next_result and next_result.GetError().Success():
                cur_addr = str(next_result.GetValue() or "0x0")
            else:
                break

            step += 1

    return nodes, edges


def handle_walk_hashmap(cmd: dict, ctx: dict) -> None:
    """Walk a hash table structure.

    Command: {
        "cmd": "walk_hashmap",
        "root_var": "table",
        "mode": "chaining" | "open_addressing"
    }

    For chaining mode: table is an array of linked list head pointers.
    For open addressing: table is an array of key-value entries.
    """
    root_var = cmd.get("root_var", "")
    mode = cmd.get("mode", "chaining")
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
        if mode == "chaining":
            nodes, edges = _walk_hashmap_chaining(frame, root_var)
        else:
            nodes, edges = _walk_hashmap_open_addressing(frame, root_var)

        send_response({"ok": True, "result": {"nodes": nodes, "edges": edges}})

    except Exception as e:
        send_response({"ok": False, "error": str(e)})


def _walk_hashmap_chaining(frame, table_var: str) -> tuple[list[dict], list[dict]]:
    """Walk a hash table with separate chaining.

    Table is an array of linked list head pointers.
    Each node has 'key', 'val', and 'next' fields.
    """
    nodes = []
    edges = []

    # Determine table size — evaluate the array length
    N = 7  # default bucket count
    # Try to count buckets by evaluating table_var
    size_result = frame.EvaluateExpression(f"(sizeof({table_var}) / sizeof({table_var}[0]))")
    if size_result and size_result.GetError().Success():
        try:
            N = int(str(size_result.GetValue() or "7"))
        except ValueError:
            N = 7

    max_buckets = min(N, 20)

    for i in range(max_buckets):
        # Create bucket node
        bucket_addr = f"bucket_{i}"
        nodes.append({
            "addr": bucket_addr,
            "label": "∅",  # empty by default
            "fields": {"bucket_idx": str(i)},
        })

        # Try to walk chain from bucket i
        head_expr = f"{table_var}[{i}]"
        head_result = frame.EvaluateExpression(head_expr)
        if not head_result or head_result.GetError().Fail():
            continue

        head_addr = str(head_result.GetValue() or "0x0")
        if _is_null(head_addr):
            continue

        # Walk the chain
        cur_addr = head_addr
        step = 0
        max_steps = 30
        visited = set()
        prev_node_idx = len(nodes) - 1  # bucket node index

        while not _is_null(cur_addr) and step < max_steps:
            if cur_addr in visited:
                break
            visited.add(cur_addr)

            # Read key and value fields
            key_expr = f"*((int*)({cur_addr}))"
            key_result = frame.EvaluateExpression(key_expr)
            key_str = "?"
            if key_result and key_result.GetError().Success():
                key_str = str(key_result.GetValue() or "?")

            val_expr = f"*((int*)({cur_addr} + 4))"
            val_result = frame.EvaluateExpression(val_expr)
            val_str = "?"
            if val_result and val_result.GetError().Success():
                val_str = str(val_result.GetValue() or "?")

            cur_node_idx = len(nodes)
            nodes.append({
                "addr": cur_addr,
                "label": f"{key_str}→{val_str}",
                "fields": {"key": key_str, "val": val_str},
            })

            edges.append({
                "from_idx": prev_node_idx,
                "to_idx": cur_node_idx,
            })
            prev_node_idx = cur_node_idx

            # Update bucket label to show first entry
            if step == 0:
                nodes[i]["label"] = f"{key_str}→{val_str}"

            # Next
            next_expr = f"*((unsigned long long*)({cur_addr} + 8))"
            next_result = frame.EvaluateExpression(next_expr)
            if next_result and next_result.GetError().Success():
                cur_addr = str(next_result.GetValue() or "0x0")
            else:
                break

            step += 1

    return nodes, edges


def _walk_hashmap_open_addressing(frame, table_var: str) -> tuple[list[dict], list[dict]]:
    """Walk a hash table with open addressing (linear probing).

    Table is an array of entries, each with key, val, and a state flag.
    """
    nodes = []
    edges = []

    N = 7
    size_result = frame.EvaluateExpression(f"(sizeof({table_var}) / sizeof({table_var}[0]))")
    if size_result and size_result.GetError().Success():
        try:
            N = int(str(size_result.GetValue() or "7"))
        except ValueError:
            N = 7

    max_slots = min(N, 20)

    for i in range(max_slots):
        slot_expr = f"{table_var}[{i}]"
        slot_result = frame.EvaluateExpression(slot_expr)

        key_str = "∅"
        val_str = ""
        is_empty = True

        if slot_result and slot_result.GetError().Success():
            # Try to read .key field
            key_expr = f"{table_var}[{i}].key"
            key_result = frame.EvaluateExpression(key_expr)
            if key_result and key_result.GetError().Success():
                k = str(key_result.GetValue() or "")
                if k and k != "0":
                    key_str = k
                    is_empty = False

            if not is_empty:
                val_expr = f"{table_var}[{i}].val"
                val_result = frame.EvaluateExpression(val_expr)
                if val_result and val_result.GetError().Success():
                    val_str = str(val_result.GetValue() or "")

        label = f"k:{key_str}" if not is_empty else "∅"
        if val_str:
            label += f" v:{val_str}"

        nodes.append({
            "addr": f"slot_{i}",
            "label": label,
            "fields": {"slot_idx": str(i), "key": key_str, "val": val_str, "empty": str(is_empty).lower()},
        })

    return nodes, edges


def handle_inspect_type(cmd: dict, ctx: dict) -> None:
    """Inspect a C++ struct type and return its field layout.

    Used by auto-detection to discover linked-list / binary-tree candidates
    without manual @viz annotations.

    Command: {"cmd": "inspect_type", "type_name": "ListNode"}
    Response: {
        "ok": true,
        "result": {
            "type_name": "ListNode",
            "fields": [
                {"name": "val", "type": "int", "is_pointer": false, "points_to_same_type": false},
                {"name": "next", "type": "ListNode *", "is_pointer": true, "points_to_same_type": true}
            ]
        }
    }
    """
    type_name = cmd.get("type_name", "")
    target = ctx.get("target")

    if not target:
        send_response({"ok": False, "error": "No target"})
        return

    if not type_name:
        send_response({"ok": False, "error": "Missing type_name"})
        return

    # Strip trailing whitespace / pointer asterisk
    clean_name = type_name.strip()
    if clean_name.endswith("*") or clean_name.endswith(" *"):
        clean_name = clean_name.rstrip("*").strip()

    try:
        sbtype = target.FindFirstType(clean_name)
        if not sbtype or not sbtype.IsValid():
            send_response({"ok": False, "error": f"Type not found: {clean_name}"})
            return

        fields = []
        for i in range(sbtype.GetNumberOfFields()):
            field = sbtype.GetFieldAtIndex(i)
            field_name = field.GetName() or ""
            field_type = field.GetType()
            field_type_name = str(field_type.GetName() or "")

            is_pointer = field_type_name.endswith("*") or field_type_name.endswith(" *")

            points_to_same = False
            if is_pointer:
                pointee = field_type.GetPointeeType()
                if pointee and pointee.IsValid():
                    pointee_name = str(pointee.GetName() or "")
                    points_to_same = (pointee_name == clean_name)

            fields.append({
                "name": field_name,
                "type": field_type_name,
                "is_pointer": is_pointer,
                "points_to_same_type": points_to_same,
            })

        send_response({"ok": True, "result": {"type_name": clean_name, "fields": fields}})

    except Exception as e:
        log(f"inspect_type error: {e}")
        send_response({"ok": False, "error": str(e)})


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

"""Debugger controller — abstract interface + LLDB subprocess bridge.

On macOS, LLDB's Python bindings are tied to Xcode's embedded Python 3.9.
We spawn a bridge subprocess (lldb_bridge.py) with that Python, communicating
via JSON lines over stdin/stdout. This keeps the FastAPI process independent
of the LLDB's Python version.
"""

from __future__ import annotations

import json
import os
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

# Xcode's Python 3.9 that has LLDB bindings
_PYTHON39 = (
    "/Applications/Xcode.app/Contents/Developer/Library/"
    "Frameworks/Python3.framework/Versions/3.9/bin/python3.9"
)

# Path to the bridge script (same directory as this file)
_BRIDGE_SCRIPT = os.path.join(os.path.dirname(__file__), "lldb_bridge.py")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Variable:
    name: str
    type: str
    value: str
    is_pointer: bool = False
    display_value: str = ""
    deref_type: str | None = None


@dataclass
class StackFrame:
    function: str
    line: int
    file: str


@dataclass
class DebuggerState:
    source_line: int
    file: str
    current_function: str
    locals: list[Variable] = field(default_factory=list)
    call_stack: list[StackFrame] = field(default_factory=list)
    stdout: str = ""
    is_terminated: bool = False
    exit_code: int | None = None


# ---------------------------------------------------------------------------
# Abstract interface
# ---------------------------------------------------------------------------

class DebuggerController(ABC):
    """Abstract interface for a programmatic debugger backend."""

    @abstractmethod
    def start(self, binary_path: str, source_file: str) -> None:
        ...

    @abstractmethod
    def step_over(self) -> DebuggerState:
        ...

    @abstractmethod
    def step_into(self) -> DebuggerState:
        ...

    @abstractmethod
    def step_out(self) -> DebuggerState:
        ...

    @abstractmethod
    def get_state(self) -> DebuggerState:
        ...

    @abstractmethod
    def evaluate(self, expression: str) -> str:
        ...

    @abstractmethod
    def set_breakpoint(self, line: int) -> None:
        ...

    @abstractmethod
    def remove_breakpoint(self, line: int) -> None:
        ...

    @abstractmethod
    def run_to_breakpoint(self) -> DebuggerState:
        ...

    @abstractmethod
    def terminate(self) -> None:
        ...

    @abstractmethod
    def is_running(self) -> bool:
        ...


# ---------------------------------------------------------------------------
# LLDB subprocess bridge implementation
# ---------------------------------------------------------------------------

class LLDBBridgeError(RuntimeError):
    """Error from the LLDB bridge subprocess."""


class LLDBController(DebuggerController):
    """Debugger controller that spawns an LLDB bridge subprocess."""

    def __init__(self):
        self._proc: subprocess.Popen | None = None
        self._source_file: str = ""
        self._alive: bool = False
        self._pending_bps: list[int] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, binary_path: str, source_file: str) -> None:
        """Launch the bridge subprocess and start debugging."""
        self._source_file = source_file

        if not os.path.exists(_PYTHON39):
            raise RuntimeError(
                f"Xcode Python 3.9 not found at {_PYTHON39}. "
                "Please install Xcode or Xcode Command Line Tools."
            )
        if not os.path.exists(_BRIDGE_SCRIPT):
            raise RuntimeError(f"Bridge script not found: {_BRIDGE_SCRIPT}")

        # Terminate any existing process
        self.terminate()

        # Spawn bridge
        self._proc = subprocess.Popen(
            [_PYTHON39, _BRIDGE_SCRIPT],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # Start debugging session
        resp = self._send_cmd({
            "cmd": "start",
            "binary": binary_path,
            "source_file": source_file,
            "breakpoints": self._pending_bps,
        })

        if not resp.get("ok"):
            raise RuntimeError(f"LLDB bridge start failed: {resp.get('error', 'unknown')}")

        self._alive = True

    def step_over(self) -> DebuggerState:
        resp = self._send_cmd({"cmd": "step_over"})
        return self._parse_state(resp)

    def step_into(self) -> DebuggerState:
        resp = self._send_cmd({"cmd": "step_into"})
        return self._parse_state(resp)

    def step_out(self) -> DebuggerState:
        resp = self._send_cmd({"cmd": "step_out"})
        return self._parse_state(resp)

    def get_state(self) -> DebuggerState:
        resp = self._send_cmd({"cmd": "get_state"})
        return self._parse_state(resp)

    def evaluate(self, expression: str) -> str:
        resp = self._send_cmd({"cmd": "evaluate", "expression": expression})
        if resp.get("ok"):
            return resp.get("result", {}).get("value", "")
        return f"<error: {resp.get('error', 'unknown')}>"

    def set_breakpoint(self, line: int) -> None:
        if line not in self._pending_bps:
            self._pending_bps.append(line)
        if self._proc and self._alive:
            self._send_cmd({"cmd": "set_breakpoint", "line": line})

    def remove_breakpoint(self, line: int) -> None:
        if line in self._pending_bps:
            self._pending_bps.remove(line)
        if self._proc and self._alive:
            self._send_cmd({"cmd": "remove_breakpoint", "line": line})

    def run_to_breakpoint(self) -> DebuggerState:
        resp = self._send_cmd({"cmd": "continue"})
        return self._parse_state(resp)

    def terminate(self) -> None:
        if self._proc is None:
            return

        try:
            self._send_cmd({"cmd": "terminate"})
        except (LLDBBridgeError, BrokenPipeError):
            pass  # bridge may already be dead

        # Ensure subprocess is gone
        try:
            self._proc.stdin.close()
            self._proc.stdout.close()
            self._proc.wait(timeout=3)
        except (subprocess.TimeoutExpired, OSError):
            self._proc.kill()
            self._proc.wait()

        self._proc = None
        self._alive = False

    def is_running(self) -> bool:
        if self._proc is None:
            return False
        # Check if the subprocess is still alive
        poll = self._proc.poll()
        if poll is not None:
            self._alive = False
            return False
        return self._alive

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _send_cmd(self, cmd: dict) -> dict:
        """Send a JSON command to the bridge and return the response."""
        if self._proc is None or self._proc.poll() is not None:
            raise LLDBBridgeError("Bridge subprocess is not running")

        line = json.dumps(cmd)
        try:
            self._proc.stdin.write(line + "\n")
            self._proc.stdin.flush()
        except BrokenPipeError:
            self._alive = False
            raise LLDBBridgeError("Bridge subprocess pipe broken")

        # Read response
        try:
            resp_line = self._proc.stdout.readline()
        except Exception as e:
            self._alive = False
            raise LLDBBridgeError(f"Failed to read from bridge: {e}")

        if not resp_line:
            self._alive = False
            raise LLDBBridgeError("Bridge subprocess terminated unexpectedly")

        try:
            resp = json.loads(resp_line)
        except json.JSONDecodeError as e:
            raise LLDBBridgeError(f"Invalid JSON from bridge: {resp_line[:200]}")

        if not resp.get("ok"):
            raise LLDBBridgeError(resp.get("error", "Unknown bridge error"))

        return resp

    def _parse_state(self, resp: dict) -> DebuggerState:
        """Convert bridge state response into a DebuggerState."""
        result = resp.get("result", {})
        is_terminated = result.get("is_terminated", False)

        # Parse locals
        locals_list = []
        for item in result.get("locals", []):
            locals_list.append(Variable(
                name=item.get("name", ""),
                type=item.get("type", ""),
                value=item.get("value", ""),
                is_pointer=item.get("is_pointer", False),
                display_value=item.get("display_value", item.get("value", "")),
                deref_type=item.get("deref_type"),
            ))

        # Parse call stack
        call_stack_list = []
        for item in result.get("call_stack", []):
            call_stack_list.append(StackFrame(
                function=item.get("function", ""),
                line=item.get("line", 0),
                file=item.get("file", self._source_file),
            ))

        self._alive = not is_terminated

        return DebuggerState(
            source_line=result.get("source_line", 0),
            file=result.get("file", self._source_file),
            current_function=result.get("current_function", ""),
            locals=locals_list,
            call_stack=call_stack_list,
            stdout=result.get("stdout", ""),
            is_terminated=is_terminated,
            exit_code=result.get("exit_code"),
        )

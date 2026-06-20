"""Compile C/C++ source code using clang++/g++."""

import os
import re
import subprocess
from dataclasses import dataclass, field

from config import COMPILER, COMPILER_FLAGS, TEMP_ROOT


@dataclass
class CompileResult:
    success: bool
    binary_path: str | None = None
    errors: list[dict] = field(default_factory=list)
    # Each error dict: {"line": int|None, "message": str}


class CodeCompiler:
    """Compiles C/C++ source code to a binary with debug symbols."""

    def __init__(self, compiler: str | None = None, flags: list[str] | None = None):
        self.compiler = compiler or COMPILER
        self.flags = flags or COMPILER_FLAGS

    def compile(self, code: str, session_id: str) -> CompileResult:
        """Compile source code and return result.

        Args:
            code: C/C++ source code as a string.
            session_id: Unique session ID for isolating temp files.

        Returns:
            CompileResult with success status, binary path or error list.
        """
        work_dir = os.path.join(TEMP_ROOT, session_id)
        os.makedirs(work_dir, exist_ok=True)

        source_path = os.path.join(work_dir, "main.cpp")
        binary_path = os.path.join(work_dir, "main")

        # Write source file
        with open(source_path, "w") as f:
            f.write(code)

        # Compile
        cmd = [self.compiler] + self.flags + ["-o", binary_path, source_path]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
            )
        except subprocess.TimeoutExpired:
            return CompileResult(
                success=False,
                errors=[{"line": None, "message": "Compilation timed out after 15 seconds"}],
            )

        if result.returncode != 0:
            errors = self._parse_errors(result.stderr, source_path)
            return CompileResult(success=False, errors=errors)

        return CompileResult(success=True, binary_path=binary_path)

    def _parse_errors(self, stderr: str, source_path: str) -> list[dict]:
        """Parse compiler error output into structured error dicts.

        Handles both clang++ and g++ error formats:
          clang:  main.cpp:10:5: error: ...
          gcc:    main.cpp:10:5: error: ...
        """
        errors = []
        pattern = re.compile(
            rf"{re.escape(source_path)}:(\d+):(\d+):\s*(error|warning):\s*(.*)"
        )
        for line in stderr.strip().split("\n"):
            m = pattern.match(line)
            if m:
                errors.append({
                    "line": int(m.group(1)),
                    "column": int(m.group(2)),
                    "severity": m.group(3),  # "error" or "warning"
                    "message": m.group(4),
                })
            elif line.strip():
                # Non-matching line — append to last error's message
                if errors:
                    errors[-1]["message"] += "\n" + line
                else:
                    errors.append({"line": None, "message": line})

        return errors

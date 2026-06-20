"""Central configuration for the C/C++ Visualizer backend."""

import os
import tempfile

# Directory for temporary files (source code, compiled binaries)
TEMP_ROOT = os.path.join(tempfile.gettempdir(), "cpp-viz")

# Compiler settings
COMPILER = os.environ.get("CPP_VIZ_COMPILER", "clang++")
COMPILER_FLAGS = [
    "-g",                      # Debug symbols
    "-O0",                     # No optimization (preserve source correspondence)
    "-std=c++17",              # C++17 standard
    "-fstandalone-debug",      # Keep debug info in binary (macOS)
]

# Execution limits
MAX_STEPS = 10_000             # Max steps before forced termination
EXECUTION_TIMEOUT = 30         # Seconds before killing a running process
SESSION_IDLE_TIMEOUT = 1800    # 30 minutes idle before auto-cleanup

# Server settings
HOST = os.environ.get("CPP_VIZ_HOST", "127.0.0.1")
PORT = int(os.environ.get("CPP_VIZ_PORT", "8000"))

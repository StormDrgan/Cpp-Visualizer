"""Session manager — in-memory session lifecycle management.

Each session holds:
  - A unique session ID
  - Compiled source code path and binary path
  - Debugger controller instance
  - History and future stacks of state snapshots
  - Idle timer for auto-cleanup
"""

from __future__ import annotations
import uuid
import threading
from dataclasses import dataclass, field

from config import SESSION_IDLE_TIMEOUT


@dataclass
class SessionState:
    session_id: str
    source_code: str = ""
    binary_path: str = ""
    source_file: str = "main.cpp"
    step_number: int = 0

    # Snapshot stacks for time-travel
    history: list[dict] = field(default_factory=list)   # past snapshots
    future: list[dict] = field(default_factory=list)    # undone snapshots (for forward)

    # §v0.8: user-selected visualization targets (variable names)
    selected_vars: list[str] | None = None

    # Timer for auto-cleanup
    _timer: threading.Timer | None = field(default=None, repr=False)

    def reset_timer(self, callback, timeout: int = SESSION_IDLE_TIMEOUT):
        """Reset the idle timer. Called on every user interaction."""
        if self._timer:
            self._timer.cancel()
        self._timer = threading.Timer(timeout, callback, args=[self.session_id])
        self._timer.daemon = True
        self._timer.start()

    def cancel_timer(self):
        """Cancel the idle timer."""
        if self._timer:
            self._timer.cancel()
            self._timer = None


class SessionManager:
    """In-memory session registry with auto-cleanup."""

    def __init__(self):
        self._sessions: dict[str, SessionState] = {}
        self._lock = threading.Lock()

    def create(self) -> str:
        """Create a new session and return its ID."""
        session_id = uuid.uuid4().hex[:12]
        session = SessionState(session_id=session_id)
        with self._lock:
            self._sessions[session_id] = session
        return session_id

    def get(self, session_id: str) -> SessionState | None:
        """Get session by ID, or None if not found."""
        with self._lock:
            return self._sessions.get(session_id)

    def delete(self, session_id: str) -> bool:
        """Delete a session. Returns True if it existed."""
        with self._lock:
            session = self._sessions.pop(session_id, None)
            if session:
                session.cancel_timer()
                return True
            return False

    def start_cleanup_timer(self, session_id: str):
        """Start the idle cleanup timer for a session."""
        session = self.get(session_id)
        if session:
            session.reset_timer(self.delete)

    def cancel_cleanup_timer(self, session_id: str):
        """Cancel the cleanup timer."""
        session = self.get(session_id)
        if session:
            session.cancel_timer()

    def cleanup_all(self):
        """Delete all sessions. Called on server shutdown."""
        with self._lock:
            for session in list(self._sessions.values()):
                session.cancel_timer()
            self._sessions.clear()

    @property
    def active_count(self) -> int:
        return len(self._sessions)


# Global singleton
session_manager = SessionManager()

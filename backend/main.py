"""C/C++ Visualizer — Backend entry point.

FastAPI application that provides the API for step-by-step C/C++ code
execution visualization. Uses LLDB to drive debugging and returns state
snapshots to the frontend.
"""

import atexit

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import HOST, PORT
from routers.session import router as session_router
from routers.ws import router as ws_router
from routers.ai import router as ai_router
from session_manager import session_manager

app = FastAPI(
    title="C/C++ Visualizer API",
    version="0.1.0",
    description="Backend API for the C/C++ code execution visualizer",
)

# CORS — allow frontend dev server on any port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(ws_router)
app.include_router(ai_router)


@app.on_event("shutdown")
async def shutdown():
    """Clean up all sessions on server shutdown."""
    session_manager.cleanup_all()


# Register cleanup with atexit as well (for non-graceful shutdown)
atexit.register(session_manager.cleanup_all)


if __name__ == "__main__":
    import uvicorn
    print(f"Starting C/C++ Visualizer backend on http://{HOST}:{PORT}")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)

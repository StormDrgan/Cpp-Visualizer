import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store/useStore';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import CanvasArea from './components/CanvasArea';
import VariablePanel from './components/VariablePanel';
import ControlBar from './components/ControlBar';

const DIVIDER = 4;

export default function App() {
  const createSession = useStore((s) => s.createSession);
  const connectWs = useStore((s) => s.connectWs);
  const disconnectWs = useStore((s) => s.disconnectWs);
  const sessionId = useStore((s) => s.sessionId);
  const wsConnected = useStore((s) => s.wsConnected);

  useEffect(() => {
    createSession();
    return () => {
      disconnectWs();
    };
  }, [createSession, disconnectWs]);

  useEffect(() => {
    if (sessionId && !wsConnected) {
      connectWs(sessionId);
    }
  }, [sessionId, wsConnected, connectWs]);

  // ---- Resizable panel state ----
  const [splitX, setSplitX] = useState(42);
  const [splitY, setSplitY] = useState(62);
  const splitXRef = useRef(splitX);
  splitXRef.current = splitX;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'h' | 'v' | null>(null);

  const onDividerMouseDown = useCallback((which: 'h' | 'v') => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = which;
    document.body.style.cursor = which === 'h' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (which === 'h') {
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitX(Math.min(75, Math.max(20, pct)));
      } else {
        const topY = rect.top + 40; // header height
        const bottomY = rect.bottom - 36; // control bar height
        const rightHeight = bottomY - topY;
        const mouseY = e.clientY - topY;
        const pct = (mouseY / rightHeight) * 100;
        setSplitY(Math.min(85, Math.max(15, pct)));
      }
    };

    const onUp = () => {
      dragging.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '40px 1fr 36px',
        gridTemplateColumns: `${splitX}% ${DIVIDER}px 1fr`,
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
        background: 'var(--color-page)',
      }}
    >
      {/* Header — spans all columns */}
      <div style={{ gridColumn: '1 / -1', gridRow: 1 }}>
        <Header />
      </div>

      {/* Code editor */}
      <div style={{ gridColumn: 1, gridRow: 2, overflow: 'hidden' }}>
        <CodeEditor />
      </div>

      {/* Horizontal divider */}
      <div
        style={{
          gridColumn: 2,
          gridRow: 2,
          cursor: 'col-resize',
          background: 'transparent',
          transition: 'background 0.15s',
          zIndex: 10,
        }}
        onMouseDown={onDividerMouseDown('h')}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Right side — canvas (top) + variables (bottom) */}
      <div style={{
        gridColumn: 3, gridRow: 2,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: 'var(--border-hairline)',
        background: 'var(--color-page)',
      }}>
        {/* Canvas */}
        <div style={{ flex: '1 1 auto', overflow: 'hidden', minHeight: `${splitY}%` }}>
          <CanvasArea />
        </div>

        {/* Vertical divider */}
        <div
          style={{
            height: DIVIDER,
            flexShrink: 0,
            cursor: 'row-resize',
            background: 'transparent',
            transition: 'background 0.15s',
            borderTop: 'var(--border-hairline)',
            zIndex: 10,
          }}
          onMouseDown={onDividerMouseDown('v')}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-border)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />

        {/* Variable panel */}
        <div style={{ flex: '0 1 auto', overflow: 'hidden auto', minHeight: 0 }}>
          <VariablePanel />
        </div>
      </div>

      {/* Control bar — spans all columns */}
      <div style={{ gridColumn: '1 / -1', gridRow: 3 }}>
        <ControlBar />
      </div>
    </div>
  );
}

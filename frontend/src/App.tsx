import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store/useStore';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import CanvasArea from './components/CanvasArea';
import VariablePanel from './components/VariablePanel';
import ControlBar from './components/ControlBar';

/** Thickness of the drag-to-resize divider bars */
const DIVIDER = 5;

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
        const topY = rect.top + 44;
        const bottomY = rect.bottom - 40;
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
        gridTemplateRows: '44px 1fr 40px',
        gridTemplateColumns: `${splitX}% ${DIVIDER}px 1fr`,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
      }}
    >
      {/* 顶栏 — 跨所有列 */}
      <div style={{ gridColumn: '1 / -1', gridRow: 1 }}>
        <Header />
      </div>

      {/* 左侧 — 代码编辑区 */}
      <div style={{ gridColumn: 1, gridRow: 2, overflow: 'hidden' }}>
        <CodeEditor />
      </div>

      {/* 水平分隔条 — 拖拽调整代码区/可视化区宽度 */}
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
        onMouseEnter={(e) => (e.currentTarget.style.background = '#e0e0e0')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />

      {/* 右侧 — 上下结构：画布(上) + 变量(下) */}
      <div style={{
        gridColumn: 3, gridRow: 2,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid #e8e8e8',
      }}>
        {/* 可视化画布 — 始终填满面板上方全部空间，minHeight 保证至少 splitY% */}
        <div style={{ flex: '1 1 auto', overflow: 'hidden', minHeight: `${splitY}%` }}>
          <CanvasArea />
        </div>

        {/* 垂直分隔条 — 拖拽调整画布最小占比 */}
        <div
          style={{
            height: DIVIDER,
            flexShrink: 0,
            cursor: 'row-resize',
            background: 'transparent',
            transition: 'background 0.15s',
            borderTop: '1px solid #e8e8e8',
            zIndex: 10,
          }}
          onMouseDown={onDividerMouseDown('v')}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e0e0e0')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        />

        {/* 变量面板 — 折叠后紧跟分隔条；内容过多时可滚动 */}
        <div style={{ flex: '0 1 auto', overflow: 'hidden auto', minHeight: 0 }}>
          <VariablePanel />
        </div>
      </div>

      {/* 底栏 — 跨所有列 */}
      <div style={{ gridColumn: '1 / -1', gridRow: 3 }}>
        <ControlBar />
      </div>
    </div>
  );
}

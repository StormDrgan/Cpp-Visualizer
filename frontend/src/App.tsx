import { useEffect } from 'react';
import { useStore } from './store/useStore';
import Header from './components/Header';
import CodeEditor from './components/CodeEditor';
import CanvasArea from './components/CanvasArea';
import VariablePanel from './components/VariablePanel';
import ControlBar from './components/ControlBar';

export default function App() {
  const createSession = useStore((s) => s.createSession);

  useEffect(() => {
    createSession();
  }, [createSession]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '44px 1fr 44px',
        gridTemplateColumns: '42% 1fr 288px',
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

      {/* 中间 — 可视化画布 */}
      <div style={{ gridColumn: 2, gridRow: 2, overflow: 'hidden' }}>
        <CanvasArea />
      </div>

      {/* 右侧 — 信息面板 */}
      <div style={{ gridColumn: 3, gridRow: 2, overflow: 'hidden' }}>
        <VariablePanel />
      </div>

      {/* 底栏 — 跨所有列 */}
      <div style={{ gridColumn: '1 / -1', gridRow: 3 }}>
        <ControlBar />
      </div>
    </div>
  );
}

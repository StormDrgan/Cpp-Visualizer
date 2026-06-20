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
        gridTemplateColumns: '42% 1fr',
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

      {/* 右侧 — 上下结构：画布(上) + 变量(下) */}
      <div style={{
        gridColumn: 2, gridRow: 2,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: '1px solid #e8e8e8',
      }}>
        {/* 可视化画布 — 上部 */}
        <div style={{ flex: '1 1 55%', overflow: 'hidden', borderBottom: '2px solid #e8e8e8' }}>
          <CanvasArea />
        </div>
        {/* 变量面板 — 下部 */}
        <div style={{ flex: '1 1 45%', overflow: 'hidden', minHeight: 200 }}>
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

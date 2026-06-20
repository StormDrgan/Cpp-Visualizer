import { useStore } from '../store/useStore';

export default function VariablePanel() {
  const snapshot = useStore((s) => s.snapshot);
  const locals = snapshot?.locals ?? [];
  const callStack = snapshot?.call_stack ?? [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 局部变量 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            height: 32,
            background: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>📦 局部变量</span>
          {locals.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: '#999',
                background: '#eee',
                borderRadius: 8,
                padding: '1px 6px',
                marginLeft: 6,
              }}
            >
              {locals.length}
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {locals.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: '#bbb',
                padding: 24,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              {snapshot ? '当前作用域无局部变量' : '编译运行代码后开始调试'}
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid #eee',
                    color: '#999',
                    fontSize: 11,
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '6px 12px', fontWeight: 500 }}>变量名</th>
                  <th style={{ padding: '6px 0', fontWeight: 500 }}>类型</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, textAlign: 'right' }}>值</th>
                </tr>
              </thead>
              <tbody>
                {locals.map((v, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #f5f5f5',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td
                      style={{
                        padding: '5px 12px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: '#1a73e8',
                        fontWeight: 500,
                      }}
                    >
                      {v.name}
                    </td>
                    <td
                      style={{
                        padding: '5px 0',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: '#888',
                      }}
                    >
                      {v.type}
                      {v.is_pointer && <span style={{ color: '#e65100' }}>*</span>}
                    </td>
                    <td
                      style={{
                        padding: '5px 12px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: v.is_pointer ? '#e65100' : '#2e7d32',
                        textAlign: 'right',
                        fontWeight: v.is_pointer ? 500 : 400,
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={v.display_value || v.value}
                    >
                      {v.display_value || v.value}
                      {v.deref_type && (
                        <span style={{ color: '#999', fontSize: 10, marginLeft: 2 }}>
                          ({v.deref_type})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 调用栈 */}
      <div
        style={{
          borderTop: '2px solid #e8e8e8',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '42%',
        }}
      >
        <div
          style={{
            height: 32,
            background: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>📚 调用栈</span>
          {callStack.length > 0 && (
            <span
              style={{
                fontSize: 10,
                color: '#999',
                background: '#eee',
                borderRadius: 8,
                padding: '1px 6px',
                marginLeft: 6,
              }}
            >
              {callStack.length}
            </span>
          )}
        </div>

        <div style={{ overflowY: 'auto' }}>
          {callStack.length === 0 ? (
            <div
              style={{
                fontSize: 12,
                color: '#bbb',
                padding: 16,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              —
            </div>
          ) : (
            callStack.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                  borderBottom: '1px solid #f5f5f5',
                  color: i === 0 ? '#1a73e8' : '#999',
                  fontWeight: i === 0 ? 500 : 400,
                }}
              >
                <span style={{ color: '#bbb', marginRight: 4 }}>#{i}</span>
                {f.function || '??'}()
                <span
                  style={{
                    color: '#bbb',
                    marginLeft: 6,
                    fontSize: 10,
                  }}
                >
                  {f.file}:{f.line}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

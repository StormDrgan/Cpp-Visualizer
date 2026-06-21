import { useStore } from '../store/useStore';

/** v0.9: Step history timeline — horizontal scrollable step pills. */
export default function HistoryPanel() {
  const historySteps = useStore((s) => s.historySteps);
  const currentStep = useStore((s) => s.snapshot?.step_number ?? 0);
  const jumpToStep = useStore((s) => s.jumpToStep);
  const code = useStore((s) => s.code);

  if (historySteps.length === 0) {
    return (
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderTop: '1px solid #e8e8e8',
        background: '#fafafa',
        fontSize: 12,
        color: '#ccc',
      }}>
        Run code to see step history
      </div>
    );
  }

  const lines = code.split('\n');

  return (
    <div style={{
      height: 48,
      borderTop: '1px solid #e8e8e8',
      background: '#fafafa',
      display: 'flex',
      alignItems: 'center',
      overflowX: 'auto',
      overflowY: 'hidden',
      gap: 6,
      padding: '0 12px',
      userSelect: 'none',
      scrollBehavior: 'smooth',
    }}>
      {historySteps.map((step) => {
        const isActive = step.step_number === currentStep;
        const lineText = lines[step.source_line - 1]?.trim() ?? '';
        const summary = lineText.length > 50
          ? lineText.substring(0, 50) + '…'
          : lineText;

        return (
          <div
            key={step.step_number}
            onClick={() => jumpToStep(step.step_number)}
            title={`Step ${step.step_number} · Line ${step.source_line}: ${lineText}`}
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'monospace',
              background: isActive ? '#e3f2fd' : '#fff',
              border: isActive ? '1px solid #1a73e8' : '1px solid #e8e8e8',
              color: isActive ? '#1a73e8' : '#666',
              fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ opacity: 0.6, marginRight: 4 }}>S{step.step_number}</span>
            <span style={{ opacity: 0.6, marginRight: 4 }}>·</span>
            {summary}
          </div>
        );
      })}
    </div>
  );
}

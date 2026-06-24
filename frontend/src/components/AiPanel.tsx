import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { aiAnnotate, aiProviders, type AiAnnotateResponse, type AiProviderInfo } from '../api/ai';
import { insertAnnotationAbove } from '../utils/annotations';

/**
 * AI annotation panel — button in CodeEditor toolbar + preview/confirm modal.
 *
 * Graph Paper design tokens applied throughout.
 */

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
};

export default function AiPanel() {
  const code = useStore((s) => s.code);
  const setCode = useStore((s) => s.setCode);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAnnotateResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Provider state
  const [providersReady, setProvidersReady] = useState(false);
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('lmstudio');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Auto-dismiss error after 4s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Auto-detect available providers on mount
  useEffect(() => {
    aiProviders()
      .then((list) => {
        setProviders(list);
        // Prefer LM Studio over Ollama
        const lmstudio = list.find((p) => p.name === 'lmstudio' && p.connected);
        const ollama = list.find((p) => p.name === 'ollama' && p.connected);
        const connected = lmstudio || ollama || list.find((p) => p.connected);
        if (connected) {
          setSelectedProvider(connected.name);
          // Auto-select first model
          if (connected.models.length > 0) {
            setSelectedModel(connected.models[0]);
          }
        }
        setProvidersReady(true);
      })
      .catch(() => {
        setProvidersReady(true); // allow manual selection even if API fails
      });
  }, []);

  const currentProvider = providers.find((p) => p.name === selectedProvider);
  const connectedProvider = currentProvider?.connected ?? false;
  const availableModels = currentProvider?.models ?? [];

  // When provider changes, auto-select first model
  const handleProviderChange = (name: string) => {
    setSelectedProvider(name);
    const p = providers.find((p) => p.name === name);
    if (p && p.models.length > 0) {
      setSelectedModel(p.models[0]);
    } else {
      setSelectedModel('');
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!connectedProvider) {
      setError(`未连接 LLM 服务。请启动 ${PROVIDER_LABELS[selectedProvider] || selectedProvider}。`);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await aiAnnotate({ code, provider: selectedProvider, model: selectedModel || undefined });

    if (!res.ok) {
      setError(res.error || 'AI 分析失败');
      setLoading(false);
      return;
    }

    if (res.annotations.length === 0) {
      setError('AI 未检测到可可视化的数据结构');
      setLoading(false);
      return;
    }

    setResult(res);
    setChecked(new Set(res.annotations.map((_, i) => i)));
    setShowModal(true);
    setLoading(false);
  }, [code, selectedProvider, selectedModel]);

  const handleApply = useCallback(() => {
    if (!result) return;

    let newCode = code;
    // Apply annotations in reverse line order so line numbers stay valid
    // @viz annotations go before main() — they're just comments
    // Insert all at the top of main function
    const mainIndex = newCode.indexOf('int main()');
    const insertPos = mainIndex !== -1
      ? newCode.substring(0, mainIndex).split('\n').length
      : newCode.split('\n').length;

    // Collect selected annotations (in order)
    const selectedAnns = result.annotations.filter((_, i) => checked.has(i));

    // Insert from bottom up to keep positions stable
    for (let i = selectedAnns.length - 1; i >= 0; i--) {
      newCode = insertAnnotationAbove(newCode, insertPos, selectedAnns[i]);
    }

    setCode(newCode);
    setShowModal(false);
    setResult(null);
  }, [code, result, checked, setCode]);

  const toggleCheck = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <>
      {/* Provider indicator + AI Analyze button group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Provider selector with status dot */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <span style={{
            position: 'absolute',
            left: 7,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: connectedProvider ? '#2d8a7b' : '#9c9b95',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
          <select
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            title="选择 LLM 服务"
            style={{
              height: 26,
              padding: '0 8px 0 18px',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-ui)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            {providers.map((p) => (
              <option key={p.name} value={p.name}>
                {PROVIDER_LABELS[p.name] || p.name}
              </option>
            ))}
            {providers.length === 0 && (
              <>
                <option value="ollama">Ollama</option>
                <option value="lmstudio">LM Studio</option>
              </>
            )}
          </select>
        </div>

        {/* Model selector */}
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          title="选择模型"
          style={{
            height: 26,
            maxWidth: 140,
            padding: '0 6px',
            fontSize: 10,
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-secondary)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: 'none',
            cursor: 'pointer',
            outline: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {availableModels.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          {availableModels.length === 0 && (
            <option value="">无模型</option>
          )}
        </select>

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !providersReady}
          title={providersReady ? 'AI 分析代码，自动生成 @viz 标注' : '检测 LLM 服务中...'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            height: 26,
            padding: '0 10px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
            color: loading ? 'var(--color-text-tertiary)' : '#ffffff',
            background: loading
              ? 'var(--color-surface-alt)'
              : connectedProvider
                ? 'var(--color-teal)'
                : 'var(--color-text-tertiary)',
            border: loading
              ? '1px solid var(--color-border)'
              : connectedProvider
                ? '1px solid var(--color-teal)'
                : '1px solid var(--color-text-tertiary)',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!loading && connectedProvider) e.currentTarget.style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            if (!loading && connectedProvider) e.currentTarget.style.opacity = '1';
          }}
        >
          {loading ? (
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" />
              <rect x="4" y="8" width="16" height="14" rx="2" />
            </svg>
          )}
          {loading ? '分析中...' : 'AI 分析'}
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div style={{
          position: 'fixed',
          bottom: 48,
          right: 16,
          background: 'var(--color-red-light)',
          color: 'var(--color-red)',
          border: '1px solid var(--color-red)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 14px',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
          zIndex: 2000,
          boxShadow: 'var(--shadow-popover)',
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 10,
              background: 'none',
              border: 'none',
              color: 'var(--color-red)',
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Preview / Confirm modal */}
      {showModal && result && (
        <div
          onClick={() => { setShowModal(false); setResult(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1500,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 560,
              maxHeight: '80vh',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-popover)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: 'var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-page)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                <path d="M12 2a4 4 0 0 1 4 4v2H8V6a4 4 0 0 1 4-4z" />
                <rect x="4" y="8" width="16" height="14" rx="2" />
              </svg>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text)',
                letterSpacing: '0.03em',
              }}>
                AI 标注预览
              </span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-tertiary)',
              }}>
                选中 {checked.size}/{result.annotations.length} 条
              </span>
            </div>

            {/* Reasoning section */}
            {result.reasoning && (
              <div style={{
                padding: '10px 16px',
                borderBottom: 'var(--border-hairline)',
                background: 'var(--color-page)',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>分析：</span>
                {result.reasoning}
              </div>
            )}

            {/* Annotation list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {result.annotations.map((ann, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    borderBottom: i < result.annotations.length - 1 ? 'var(--border-hairline)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() => toggleCheck(i)}
                    style={{ marginTop: 2, accentColor: 'var(--color-ink)' }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--color-text)',
                    lineHeight: 1.4,
                    wordBreak: 'break-all',
                  }}>
                    {ann}
                  </span>
                </label>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{
              padding: '12px 16px',
              borderTop: 'var(--border-hairline)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              background: 'var(--color-page)',
            }}>
              <button
                onClick={() => { setShowModal(false); setResult(null); }}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                取消
              </button>
              <button
                onClick={() => {
                  const all = new Set(result.annotations.map((_, i) => i));
                  if (checked.size === result.annotations.length) {
                    setChecked(new Set());
                  } else {
                    setChecked(all);
                  }
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {checked.size === result.annotations.length ? '取消全选' : '全选'}
              </button>
              <button
                onClick={handleApply}
                disabled={checked.size === 0}
                style={{
                  padding: '6px 18px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                  color: '#ffffff',
                  background: checked.size > 0 ? 'var(--color-ink)' : 'var(--color-border)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: checked.size > 0 ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { if (checked.size > 0) e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { if (checked.size > 0) e.currentTarget.style.opacity = '1'; }}
              >
                应用选中标注
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  parseVizAnnotations,
  removeAnnotationLine,
  insertAnnotationAbove,
  STRUCT_TYPES,
  type StructTypeDef,
} from '../utils/annotations';

/** Icon per struct type */
function typeIcon(st: string): string {
  const def = STRUCT_TYPES.find((d) => d.type === st);
  return def?.icon ?? '📦';
}

function typeLabel(st: string): string {
  const def = STRUCT_TYPES.find((d) => d.type === st);
  return def?.label ?? st;
}

export default function AnnotationPanel() {
  const code = useStore((s) => s.code);
  const setCode = useStore((s) => s.setCode);
  const [collapsed, setCollapsed] = useState(false);

  const annotations = parseVizAnnotations(code);

  // ---- Add form state ----
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<StructTypeDef | null>(null);
  const [formName, setFormName] = useState('');
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  // line above which to insert (null = append at end)
  const [insertLine, setInsertLine] = useState<number | null>(null);

  // ---- Delete ----
  const handleDelete = (line: number) => {
    setCode(removeAnnotationLine(code, line));
  };

  // ---- Open add form ----
  const openAddForm = (targetLine?: number) => {
    setShowForm(true);
    setFormType(null);
    setFormName('');
    setFormFields({});
    setInsertLine(targetLine ?? null);
  };

  // ---- Select struct type ----
  const selectType = (def: StructTypeDef) => {
    setFormType(def);
    setFormName('');
    setFormFields({});
  };

  // ---- Submit form ----
  const handleSubmit = () => {
    if (!formType) return;
    const name = formName || 'auto';
    const annotation = formType.format(name, formFields);
    if (insertLine != null) {
      setCode(insertAnnotationAbove(code, insertLine, annotation));
    } else {
      // Append at end
      setCode(code + '\n' + annotation);
    }
    // Reset
    setShowForm(false);
    setFormType(null);
    setFormName('');
    setFormFields({});
    setInsertLine(null);
  };

  // ---- Summary text for an annotation ----
  const summaryText = (ann: ReturnType<typeof parseVizAnnotations>[0]): string => {
    switch (ann.struct_type) {
      case 'linked_list': return ann.prev_field
        ? `${ann.name} ← head=${ann.root_var} next=${ann.next_field} prev=${ann.prev_field}`
        : `${ann.name} ← head=${ann.root_var} next=${ann.next_field}`;
      case 'binary_tree': return `${ann.name} ← root=${ann.root_var}`;
      case 'array': return `${ann.name} ← ${ann.root_var}[${ann.length_var}]`;
      case 'stack': return `${ann.name} ← ${ann.root_var}`;
      case 'queue': return `${ann.name} ← ${ann.root_var}`;
      case 'heap': return `${ann.name} ← ${ann.root_var}`;
      case 'graph': return `${ann.name} ← ${ann.root_var} (${ann.mode})`;
      case 'hashmap': return `${ann.name} ← ${ann.root_var} (${ann.mode})`;
      case 'recursion_tree': return ann.name;
      case 'watch': return `watch: ${ann.watched_vars.join(', ')}`;
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: collapsed ? '0 0 auto' : '1 1 auto', minHeight: 0 }}>
      {/* Header — click to toggle */}
      <div
        style={{
          height: 32,
          background: '#fafafa',
          borderBottom: collapsed ? 'none' : '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>🏷️ 标注管理</span>
        {annotations.length > 0 && (
          <span style={{
            fontSize: 10, color: '#999', background: '#eee',
            borderRadius: 8, padding: '1px 6px', marginLeft: 6,
          }}>
            {annotations.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: collapsed ? undefined : 'rotate(180deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Annotation list */}
          {annotations.length === 0 && !showForm ? (
            <div style={{ fontSize: 12, color: '#bbb', padding: 16, textAlign: 'center', fontStyle: 'italic' }}>
              暂无标注 — 点击下方按钮或右键代码区添加
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {annotations.map((ann) => (
                <div
                  key={ann.line}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderBottom: '1px solid #f5f5f5',
                    fontSize: 11,
                    fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{typeIcon(ann.struct_type)}</span>
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 600,
                    color: '#1a73e8',
                    fontSize: 10,
                    minWidth: 50,
                  }}>
                    {typeLabel(ann.struct_type)}
                  </span>
                  <span style={{
                    flex: 1,
                    color: '#666',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 10,
                  }}>
                    {summaryText(ann)}
                  </span>
                  <span style={{ fontSize: 9, color: '#bbb', flexShrink: 0 }}>L{ann.line}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ann.line);
                    }}
                    title="删除此标注"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ccc',
                      fontSize: 14,
                      padding: '0 2px',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef5350')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {!showForm && (
            <button
              onClick={() => openAddForm()}
              style={{
                margin: '8px 12px',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 500,
                color: '#1a73e8',
                background: '#f0f7ff',
                border: '1px dashed #1a73e8',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e3f0fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f0f7ff';
              }}
            >
              + 添加标注
            </button>
          )}

          {/* Add form */}
          {showForm && (
            <div style={{
              padding: '10px 12px',
              borderTop: '1px solid #e8e8e8',
              background: '#fafafa',
            }}>
              {/* Step 1: Choose type */}
              {!formType ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 8 }}>
                    选择数据结构类型：
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {STRUCT_TYPES.map((def) => (
                      <button
                        key={def.type}
                        onClick={() => selectType(def)}
                        title={def.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 8px',
                          fontSize: 11,
                          fontFamily: 'inherit',
                          color: '#444',
                          background: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: 4,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f7ff';
                          e.currentTarget.style.borderColor = '#1a73e8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#e0e0e0';
                        }}
                      >
                        <span style={{ fontSize: 13 }}>{def.icon}</span>
                        <span>{def.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    style={{
                      marginTop: 8,
                      background: 'none',
                      border: 'none',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  {/* Step 2: Fill fields */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                    {formType.icon} {formType.label} — 填写参数：
                  </div>

                  {/* Name */}
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 2 }}>
                      标注名（字母数字）
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如: L, T, A"
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        fontSize: 12,
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        border: '1px solid #e0e0e0',
                        borderRadius: 3,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Type-specific fields */}
                  {formType.fields.map((field) => (
                    <div key={field.key} style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 10, color: '#888', display: 'block', marginBottom: 2 }}>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={formFields[field.key] ?? ''}
                        onChange={(e) =>
                          setFormFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          fontSize: 12,
                          fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                          border: '1px solid #e0e0e0',
                          borderRadius: 3,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={handleSubmit}
                      style={{
                        padding: '4px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#fff',
                        background: '#1a73e8',
                        border: 'none',
                        borderRadius: 3,
                        cursor: 'pointer',
                      }}
                    >
                      插入标注
                    </button>
                    <button
                      onClick={() => setShowForm(false)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        color: '#999',
                        background: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: 3,
                        cursor: 'pointer',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Generate a @viz annotation string from type and fields.
 * Exported for use by the gutter popup in CodeEditor.
 */
export function buildAnnotation(
  typeKey: string,
  fields: Record<string, string>,
): string {
  const def = STRUCT_TYPES.find((d) => d.type === typeKey);
  if (!def) return '';
  return def.format(fields.name ?? 'auto', fields);
}

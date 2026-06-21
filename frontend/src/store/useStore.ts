import { create } from 'zustand';
import type { StateSnapshot, CompileError, SessionStatus, DiffAction, Annotation } from '../types';
import { api, WebSocketClient } from '../api/client';
import { TEMPLATES, DEFAULT_TEMPLATE_ID } from '../templates';

interface Store {
  sessionId: string | null;
  status: SessionStatus;
  code: string;
  snapshot: StateSnapshot | null;
  diffActions: DiffAction[];
  annotations: Annotation[];
  breakpoints: Set<number>;
  compileErrors: CompileError[];
  error: string | null;
  activeTemplateId: string | null;

  // WebSocket
  wsClient: WebSocketClient | null;
  wsConnected: boolean;

  createSession: () => Promise<void>;
  connectWs: (sessionId: string) => Promise<void>;
  disconnectWs: () => void;
  loadCode: (code: string) => Promise<void>;
  step: (mode?: 'step_over' | 'step_into' | 'step_out') => Promise<void>;
  back: (steps?: number) => Promise<void>;
  forward: () => Promise<void>;
  runTo: () => Promise<void>;
  reset: () => Promise<void>;
  toggleBreakpoint: (line: number) => Promise<void>;
  setCode: (code: string) => void;
  clearError: () => void;
  addAnnotation: (ann: Annotation) => void;
  removeAnnotation: (index: number) => void;
  setAnnotations: (anns: Annotation[]) => void;
  loadTemplate: (templateId: string) => void;
}

const 默认模板 = TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0];
const 默认代码 = 默认模板.code;

// Helper: extract diff_actions from API/WS response
function extractDiff(response: { diff_actions?: unknown[] }): DiffAction[] {
  return (response.diff_actions ?? []) as DiffAction[];
}

export const useStore = create<Store>((set, get) => ({
  sessionId: null,
  status: 'idle',
  code: 默认代码,
  snapshot: null,
  diffActions: [],
  annotations: 默认模板.annotations,
  breakpoints: new Set<number>(),
  compileErrors: [],
  error: null,
  activeTemplateId: DEFAULT_TEMPLATE_ID,
  wsClient: null,
  wsConnected: false,

  createSession: async () => {
    try {
      const { session_id } = await api.createSession();
      set({ sessionId: session_id, status: 'idle', error: null });
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },

  connectWs: async (sessionId: string) => {
    // Disconnect any existing WS
    get().wsClient?.disconnect();

    const client = new WebSocketClient(sessionId);

    // Register message handlers that update zustand state directly
    client.on('snapshot', (_payload: unknown, diffActions?: unknown) => {
      const snap = _payload as StateSnapshot;
      set({
        snapshot: snap,
        diffActions: (diffActions ?? []) as DiffAction[],
        status: snap.is_terminated ? 'terminated' : 'paused',
        compileErrors: [],
        error: null,
      });
    });

    client.on('compile_error', (payload: unknown) => {
      set({
        status: 'idle',
        compileErrors: (payload as { errors: CompileError[] }).errors,
        snapshot: null,
      });
    });

    client.on('error', (payload: unknown) => {
      const msg = (payload as { message: string }).message;
      set({ error: msg, status: get().snapshot ? 'paused' : 'idle' });
    });

    client.on('terminated', () => {
      set({ status: 'terminated' });
    });

    try {
      await client.connect();
      set({ wsClient: client, wsConnected: true });
    } catch {
      // WS failed — HTTP fallback will be used automatically
      set({ wsClient: null, wsConnected: false });
    }
  },

  disconnectWs: () => {
    get().wsClient?.disconnect();
    set({ wsClient: null, wsConnected: false });
  },

  loadCode: async (code: string) => {
    let sessionId = get().sessionId;
    try {
      if (!sessionId) {
        const { session_id } = await api.createSession();
        sessionId = session_id;
        set({ sessionId });
      }

      const breakpoints = Array.from(get().breakpoints);
      const annotations = get().annotations;
      const ws = get().wsClient;

      if (ws?.connected) {
        // WebSocket path — response comes via message handler
        ws.send('load', { code, breakpoints, annotations: annotations as unknown[] });
        return;
      }

      // HTTP fallback
      const response = await api.loadCode(sessionId, code, breakpoints, annotations as unknown[]);

      if (response.type === 'compile_error') {
        set({
          status: 'idle',
          compileErrors: (response.payload as { errors: CompileError[] }).errors,
          snapshot: null,
        });
        return;
      }

      if (response.type === 'error') {
        set({ error: (response.payload as { message: string }).message, status: 'idle' });
        return;
      }

      if (response.type === 'snapshot') {
        set({
          code,
          status: 'paused',
          snapshot: response.payload as StateSnapshot,
          diffActions: extractDiff(response),
          compileErrors: [],
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'idle' });
    }
  },

  step: async (mode = 'step_over') => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    set({ status: 'stepping' });

    const ws = get().wsClient;
    if (ws?.connected) {
      ws.send('step', { mode });
      // Response arrives via 'snapshot' message handler → updates status
      return;
    }

    // HTTP fallback
    try {
      const response = await api.step(sessionId, mode);

      if (response.type === 'terminated') {
        set({ status: 'terminated' });
        return;
      }

      if (response.type === 'error') {
        set({ error: (response.payload as { message: string }).message, status: 'paused' });
        return;
      }

      if (response.type === 'snapshot') {
        const snap = response.payload as StateSnapshot;
        set({
          snapshot: snap,
          diffActions: extractDiff(response),
          status: snap.is_terminated ? 'terminated' : 'paused',
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'paused' });
    }
  },

  back: async (steps = 1) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    set({ status: 'rewinding' });

    const ws = get().wsClient;
    if (ws?.connected) {
      ws.send('back', { steps });
      return;
    }

    try {
      const response = await api.back(sessionId, steps);

      if (response.type === 'snapshot') {
        set({
          snapshot: response.payload as StateSnapshot,
          diffActions: extractDiff(response),
          status: 'paused',
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'paused' });
    }
  },

  forward: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    set({ status: 'stepping' });

    const ws = get().wsClient;
    if (ws?.connected) {
      ws.send('forward', {});
      return;
    }

    try {
      const response = await api.forward(sessionId);

      if (response.type === 'snapshot') {
        set({
          snapshot: response.payload as StateSnapshot,
          diffActions: extractDiff(response),
          status: 'paused',
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'paused' });
    }
  },

  runTo: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    set({ status: 'running' });

    const ws = get().wsClient;
    if (ws?.connected) {
      ws.send('run_to', {});
      return;
    }

    try {
      const response = await api.runTo(sessionId);

      if (response.type === 'terminated') {
        set({ status: 'terminated' });
        return;
      }

      if (response.type === 'snapshot') {
        const snap = response.payload as StateSnapshot;
        set({
          snapshot: snap,
          diffActions: extractDiff(response),
          status: snap.is_terminated ? 'terminated' : 'paused',
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'paused' });
    }
  },

  reset: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    const ws = get().wsClient;
    if (ws?.connected) {
      ws.send('reset', {});
      return;
    }

    try {
      const response = await api.reset(sessionId);

      if (response.type === 'compile_error') {
        set({
          status: 'idle',
          compileErrors: (response.payload as { errors: CompileError[] }).errors,
          snapshot: null,
        });
        return;
      }

      if (response.type === 'snapshot') {
        set({
          status: 'paused',
          snapshot: response.payload as StateSnapshot,
          compileErrors: [],
          error: null,
        });
      }
    } catch (e: unknown) {
      set({ error: (e as Error).message, status: 'idle' });
    }
  },

  toggleBreakpoint: async (line: number) => {
    const sessionId = get().sessionId;
    const breakpoints = new Set(get().breakpoints);
    const ws = get().wsClient;

    if (breakpoints.has(line)) {
      breakpoints.delete(line);
      if (sessionId) {
        if (ws?.connected) {
          ws.send('remove_breakpoint', { line });
        } else {
          try { await api.removeBreakpoint(sessionId, line); } catch { /* ignore */ }
        }
      }
    } else {
      breakpoints.add(line);
      if (sessionId) {
        if (ws?.connected) {
          ws.send('set_breakpoint', { line });
        } else {
          try { await api.setBreakpoint(sessionId, line); } catch { /* ignore */ }
        }
      }
    }

    set({ breakpoints });
  },

  setCode: (code: string) => {
    set({ code });
  },

  clearError: () => set({ error: null, compileErrors: [] }),

  addAnnotation: (ann: Annotation) => {
    set((s) => ({ annotations: [...s.annotations, ann] }));
  },

  removeAnnotation: (index: number) => {
    set((s) => ({
      annotations: s.annotations.filter((_, i) => i !== index),
    }));
  },

  setAnnotations: (anns: Annotation[]) => {
    set({ annotations: anns });
  },

  loadTemplate: (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    // Clear breakpoints when switching templates — old line numbers are
    // meaningless for the new code and would appear on random lines.
    // Also notify the backend if a debugger session is active.
    const sessionId = get().sessionId;
    const oldBreakpoints = get().breakpoints;
    if (sessionId && oldBreakpoints.size > 0) {
      const ws = get().wsClient;
      for (const line of oldBreakpoints) {
        if (ws?.connected) {
          ws.send('remove_breakpoint', { line });
        } else {
          try { api.removeBreakpoint(sessionId, line); } catch { /* ignore */ }
        }
      }
    }
    set({
      code: template.code,
      annotations: template.annotations,
      activeTemplateId: templateId,
      breakpoints: new Set<number>(),
      // 立即重置可视化区域和状态信息，不等用户点击运行
      snapshot: null,
      status: 'idle',
      diffActions: [],
      compileErrors: [],
      error: null,
    });
  },
}));

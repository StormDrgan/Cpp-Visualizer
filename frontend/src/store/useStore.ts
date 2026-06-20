import { create } from 'zustand';
import type { StateSnapshot, CompileError, SessionStatus, DiffAction, Annotation } from '../types';
import { api } from '../api/client';
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

  createSession: () => Promise<void>;
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

// Helper: extract diff_actions from API response if present
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

  createSession: async () => {
    try {
      const { session_id } = await api.createSession();
      set({ sessionId: session_id, status: 'idle', error: null });
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
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
    try {
      const response = await api.back(sessionId, steps);

      if (response.type === 'snapshot') {
        set({
          snapshot: response.payload as StateSnapshot,
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
    try {
      const response = await api.forward(sessionId);

      if (response.type === 'snapshot') {
        set({
          snapshot: response.payload as StateSnapshot,
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

    if (breakpoints.has(line)) {
      breakpoints.delete(line);
      if (sessionId) {
        try { await api.removeBreakpoint(sessionId, line); } catch { /* ignore */ }
      }
    } else {
      breakpoints.add(line);
      if (sessionId) {
        try { await api.setBreakpoint(sessionId, line); } catch { /* ignore */ }
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
    set({
      code: template.code,
      annotations: template.annotations,
      activeTemplateId: templateId,
    });
  },
}));

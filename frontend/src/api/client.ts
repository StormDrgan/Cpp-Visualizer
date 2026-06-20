// HTTP client for backend API

const BASE = '/api';

async function post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface ApiResponse<T = unknown> {
  type: string;
  payload: T;
  diff_actions?: unknown[];
}

export const api = {
  createSession: () =>
    post<{ session_id: string }>('/session'),

  loadCode: (sessionId: string, code: string, breakpoints: number[] = [], annotations: unknown[] = []) =>
    post<ApiResponse>(`/session/${sessionId}/load`, { code, breakpoints, annotations }),

  step: (sessionId: string, mode: 'step_over' | 'step_into' | 'step_out' = 'step_over') =>
    post<ApiResponse>(`/session/${sessionId}/step`, { mode }),

  back: (sessionId: string, steps: number = 1) =>
    post<ApiResponse>(`/session/${sessionId}/back`, { steps }),

  forward: (sessionId: string) =>
    post<ApiResponse>(`/session/${sessionId}/forward`),

  runTo: (sessionId: string) =>
    post<ApiResponse>(`/session/${sessionId}/run-to`),

  reset: (sessionId: string) =>
    post<ApiResponse>(`/session/${sessionId}/reset`),

  setBreakpoint: (sessionId: string, line: number) =>
    post<{ status: string; line: number }>(`/session/${sessionId}/set-breakpoint`, { line }),

  removeBreakpoint: (sessionId: string, line: number) =>
    post<{ status: string; line: number }>(`/session/${sessionId}/remove-breakpoint`, { line }),

  eval: (sessionId: string, expression: string) =>
    post<{ expression: string; value: string }>(`/session/${sessionId}/eval`, { expression }),

  deleteSession: (sessionId: string) =>
    del<{ status: string }>(`/session/${sessionId}`),

  health: () =>
    fetch(`${BASE}/health`).then(r => r.json()),
};

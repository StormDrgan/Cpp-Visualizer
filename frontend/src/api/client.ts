// HTTP client for backend API (also WebSocket client for real-time communication)

const BASE = '/api';

// ---------------------------------------------------------------------------
// WebSocket client
// ---------------------------------------------------------------------------

type MessageHandler = (payload: unknown, ...extra: unknown[]) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private handlers = new Map<string, MessageHandler[]>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  public connected = false;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  connect(): Promise<void> {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws/${this.sessionId}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      };
      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string);
          const type = msg.type as string;
          const list = this.handlers.get(type) ?? [];
          // Always pass payload + diff_actions (if present) for snapshot-type messages
          for (const h of list) {
            h(msg.payload, msg.diff_actions);
          }
        } catch {
          // ignore parse errors
        }
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.scheduleReconnect();
      };
      this.ws.onerror = () => {
        // onclose fires after onerror; reject only on initial connect
        if (!this.connected) {
          reject(new Error('WebSocket connection failed'));
        }
      };
    });
  }

  send(type: string, payload?: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload: payload ?? {} }));
    }
  }

  on(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  off(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) ?? [];
    this.handlers.set(type, list.filter((h) => h !== handler));
  }

  disconnect(): void {
    this.handlers.clear();
    this.reconnectAttempts = this.maxReconnectAttempts + 1; // prevent reconnect
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers (fallback when WebSocket is not available)
// ---------------------------------------------------------------------------

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

  loadCode: (sessionId: string, code: string, breakpoints: number[] = [], selected_vars: string[] | null = null) =>
    post<ApiResponse>(`/session/${sessionId}/load`, { code, breakpoints, selected_vars }),

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

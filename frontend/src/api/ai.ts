// AI annotation API client

const BASE = '/api/ai';

export interface AiAnnotateRequest {
  code: string;
  provider?: string;
  model?: string;
}

export interface AiAnnotateResponse {
  ok: boolean;
  annotations: string[];
  reasoning: string;
  error: string;
}

export interface AiProviderInfo {
  name: string;
  connected: boolean;
  models: string[];
}

export async function aiAnnotate(req: AiAnnotateRequest): Promise<AiAnnotateResponse> {
  const resp = await fetch(`${BASE}/annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    return {
      ok: false,
      annotations: [],
      reasoning: '',
      error: `HTTP ${resp.status}: ${resp.statusText}`,
    };
  }

  return resp.json();
}

export async function aiProviders(): Promise<AiProviderInfo[]> {
  const resp = await fetch(`${BASE}/providers`);
  if (!resp.ok) return [];
  return resp.json();
}

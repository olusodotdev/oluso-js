export const DEFAULT_MONITOR_ENDPOINT = 'https://api.oluso.dev/api/v1/monitors/events';

export type MonitorIncidentKind =
  | 'failed'
  | 'wrong'
  | 'slow'
  | 'stuck'
  | 'missing'
  | 'unavailable';

export interface MonitorReference {
  /** Mongo monitor ID shown in Project -> Monitors. */
  monitorId?: string;
  /** Monitor name; use this only when an ID is not available. */
  monitor?: string;
}

export interface MonitorClientOptions {
  apiKey: string;
  endpoint?: string;
  timeout?: number;
  retries?: number;
  sensitiveKeys?: string[];
}

export interface MonitorReceipt {
  accepted: boolean;
  check?: Record<string, unknown>;
  workflow_run?: Record<string, unknown>;
}

export interface HeartbeatOptions {
  status?: 'success' | 'ok' | 'failed';
  durationMs?: number;
  message?: string;
  context?: Record<string, unknown>;
  /** @deprecated Use context. Kept for compatibility with the first monitor preview. */
  evidence?: Record<string, unknown>;
  timestamp?: number;
}

export interface AssertionOptions extends MonitorReference {
  runId?: string;
  passed: boolean;
  kind?: MonitorIncidentKind;
  expected?: unknown;
  actual?: unknown;
  durationMs?: number;
  message?: string;
  context?: Record<string, unknown>;
  timestamp?: number;
}

export interface WorkflowEventOptions {
  durationMs?: number;
  message?: string;
  context?: Record<string, unknown>;
  timestamp?: number;
}

export class MonitorRequestError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) {
    super(message);
    this.name = 'MonitorRequestError';
  }
}

const sensitivePattern = /password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key|session|jwt|cvv|pin/i;

function sanitize(value: unknown, customSensitiveKeys: string[], depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth >= 8) return '[Max Depth Reached]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 4000 ? `${value.slice(0, 4000)}... [truncated]` : value;
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular Reference]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, customSensitiveKeys, depth + 1, seen));
  const output: Record<string, unknown> = {};
  const customPatterns = customSensitiveKeys.map((key) => key.toLowerCase());
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    const lower = key.toLowerCase();
    output[key] = sensitivePattern.test(key) || customPatterns.some((pattern) => lower.includes(pattern))
      ? '[REDACTED]'
      : sanitize(item, customSensitiveKeys, depth + 1, seen);
  }
  return output;
}

function monitorReference(reference: MonitorReference): Record<string, string> {
  if (reference.monitorId) return { monitor_id: reference.monitorId };
  if (reference.monitor) return { monitor: reference.monitor };
  throw new TypeError('monitorId or monitor is required');
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createRunId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** SDK-independent client for outcome, heartbeat, and workflow evidence. */
export class MonitorClient {
  private readonly endpoint: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly sensitiveKeys: string[];

  constructor(private readonly options: MonitorClientOptions) {
    if (!options.apiKey) throw new TypeError('apiKey is required');
    this.endpoint = options.endpoint || DEFAULT_MONITOR_ENDPOINT;
    this.timeout = options.timeout ?? 5000;
    this.retries = Math.max(0, Math.min(options.retries ?? 2, 5));
    this.sensitiveKeys = options.sensitiveKeys ?? [];
  }

  heartbeat(url: string, options: HeartbeatOptions = {}): Promise<MonitorReceipt> {
    if (!/^https:\/\//i.test(url)) throw new TypeError('heartbeat URL must use HTTPS');
    return this.send(url, {
      status: options.status || 'success',
      duration_ms: options.durationMs,
      message: options.message,
      evidence: sanitize(options.context || options.evidence || {}, this.sensitiveKeys),
      timestamp: options.timestamp ?? Date.now(),
    }, false);
  }

  assertOutcome(options: AssertionOptions): Promise<MonitorReceipt> {
    return this.send(this.endpoint, {
      ...monitorReference(options),
      run_id: options.runId,
      passed: options.passed,
      kind: options.kind || 'wrong',
      expected: sanitize(options.expected, this.sensitiveKeys),
      actual: sanitize(options.actual, this.sensitiveKeys),
      duration_ms: options.durationMs,
      message: options.message,
      context: sanitize(options.context || {}, this.sensitiveKeys),
      timestamp: options.timestamp ?? Date.now(),
    }, true);
  }

  workflow(reference: MonitorReference, runId?: string): MonitorWorkflow {
    const resolvedRunId = runId?.trim() || createRunId();
    return new MonitorWorkflow(this, reference, resolvedRunId);
  }

  async workflowEvent(reference: MonitorReference, runId: string, state: string, status: 'running' | 'failed' | 'completed', options: WorkflowEventOptions = {}): Promise<MonitorReceipt> {
    if (!state.trim()) throw new TypeError('state is required');
    return this.send(this.endpoint, {
      ...monitorReference(reference),
      run_id: runId,
      state,
      status,
      duration_ms: options.durationMs,
      message: options.message,
      context: sanitize(options.context || {}, this.sensitiveKeys),
      timestamp: options.timestamp ?? Date.now(),
    }, true);
  }

  private async send(url: string, payload: Record<string, unknown>, authenticated: boolean): Promise<MonitorReceipt> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = typeof AbortController === 'undefined' ? undefined : new AbortController();
      const timer = controller ? setTimeout(() => controller.abort(), this.timeout) : undefined;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authenticated) headers['x-oluso-signature'] = this.options.apiKey;
        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller?.signal });
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (response.ok) return { accepted: body.accepted !== false, ...body } as MonitorReceipt;
        const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
        const error = new MonitorRequestError(String(body.error || `monitor request failed with status ${response.status}`), response.status, retryable);
        if (!retryable) throw error;
        lastError = error;
      } catch (error) {
        if (error instanceof MonitorRequestError && !error.retryable) throw error;
        lastError = error;
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (attempt < this.retries) await sleep(100 * 2 ** attempt);
    }
    if (lastError instanceof MonitorRequestError) throw lastError;
    throw new MonitorRequestError(lastError instanceof Error ? lastError.message : 'monitor request failed', undefined, true);
  }
}

export class MonitorWorkflow {
  private lastState?: string;

  constructor(private readonly client: MonitorClient, private readonly reference: MonitorReference, public readonly runId: string) {}

  checkpoint(state: string, context?: Record<string, unknown>, options: Omit<WorkflowEventOptions, 'context'> = {}): Promise<MonitorReceipt> {
    this.lastState = state;
    return this.client.workflowEvent(this.reference, this.runId, state, 'running', { ...options, context });
  }

  fail(state: string, message: string, context?: Record<string, unknown>, options: Omit<WorkflowEventOptions, 'context' | 'message'> = {}): Promise<MonitorReceipt> {
    this.lastState = state;
    return this.client.workflowEvent(this.reference, this.runId, state, 'failed', { ...options, context, message });
  }

  complete(stateOrContext?: string | Record<string, unknown>, context?: Record<string, unknown>): Promise<MonitorReceipt> {
    const state = typeof stateOrContext === 'string' ? stateOrContext : this.lastState;
    const finalContext = typeof stateOrContext === 'string' ? context : stateOrContext;
    if (!state) throw new TypeError('complete requires a final state or a previous checkpoint');
    this.lastState = state;
    return this.client.workflowEvent(this.reference, this.runId, state, 'completed', { context: finalContext });
  }
}

/**
 * Emma QA live client.
 *
 * The browser never calls the adapter directly. Callers pass a same-origin
 * proxy (`requestCustomRuntime`). This module only allows HTTP to 127.0.0.1
 * or localhost, and the only mutating call is the fixed Emma phrase that the
 * adapter classifies as forecast_pytest.
 *
 * A Windows browser should open the Hermes Next server. Next, running in WSL,
 * is the process that fetches 127.0.0.1:7770. The adapter stays on localhost.
 */

export const EMMA_SESSION_ID = "agent:qa:main";
export const LOCAL_ADAPTER_URL = "http://127.0.0.1:7770";
/** Fixed allowlisted phrase. Emma + execute + tests + forecast. */
export const FORECAST_PYTEST_INSTRUCTION = "Ejecutá tests forecast";

export type EmmaJobPhase = "pending" | "running" | "completed" | "error" | "unknown";

export type EmmaPytestJob = {
  jobId: string;
  status: string;
  phase: EmmaJobPhase;
  passed: number | null;
  failed: number | null;
  skipped: number | null;
  durationMs: number | null;
  summary: string | null;
  errorSummary: string | null;
  isolationMode: string | null;
  exitCode: number | null;
  createdAt: string | null;
};

export type EmmaAdapterSnapshot = {
  ok: boolean;
  status: string | null;
  isolationEnforced: boolean;
  isolationMode: string | null;
  codexEnabled: boolean;
  latestPytest: EmmaPytestJob | null;
};

export type CustomRuntimeRequest = (input: {
  runtimeUrl: string;
  pathname: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}) => Promise<unknown>;

export function isEmmaAgentId(agentId: string): boolean {
  const id = agentId.trim().toLowerCase();
  if (!id) return false;
  return id === "qa" || id === "emma" || id === EMMA_SESSION_ID || id.startsWith("agent:qa:");
}

export function isEmmaSelection(agent: { id?: string | null; name?: string | null }): boolean {
  if (agent.id && isEmmaAgentId(agent.id)) return true;
  return (agent.name ?? "").trim().toLowerCase() === "emma";
}

export function assertLocalAdapterUrl(runtimeUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(runtimeUrl.trim());
  } catch {
    throw new Error("La URL del adapter no es válida.");
  }
  if (parsed.protocol !== "http:") {
    throw new Error("Emma QA solo acepta http hacia el adapter local.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Emma QA se niega a contactar un adapter que no sea localhost.");
  }
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function jobPhase(status: string | null | undefined): EmmaJobPhase {
  switch ((status ?? "").toUpperCase()) {
    case "QUEUED":
      return "pending";
    case "RUNNING":
      return "running";
    case "PASSED":
      return "completed";
    case "FAILED":
    case "TIMEOUT":
    case "ERROR":
    case "CANCELLED":
      return "error";
    default:
      return "unknown";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parsePytestJob(value: unknown): EmmaPytestJob | null {
  const record = asRecord(value);
  if (!record || record.type !== "forecast_pytest") return null;
  const jobId = asString(record.jobId);
  const status = asString(record.status);
  if (!jobId || !status) return null;
  return {
    jobId,
    status,
    phase: jobPhase(status),
    passed: asNumber(record.passed),
    failed: asNumber(record.failed),
    skipped: asNumber(record.skipped),
    durationMs: asNumber(record.durationMs),
    summary: asString(record.summary),
    errorSummary: asString(record.errorSummary),
    isolationMode: asString(record.isolationMode),
    exitCode: asNumber(record.exitCode),
    createdAt: asString(record.createdAt),
  };
}

export function parseJobPayload(payload: unknown): EmmaPytestJob | null {
  const record = asRecord(payload);
  if (record && "job" in record) return parsePytestJob(record.job);
  return parsePytestJob(payload);
}

export function latestPytestJob(payload: unknown): EmmaPytestJob | null {
  const record = asRecord(payload);
  const jobs = Array.isArray(record?.jobs) ? record.jobs : [];
  for (let index = jobs.length - 1; index >= 0; index -= 1) {
    const parsed = parsePytestJob(jobs[index]);
    if (parsed) return parsed;
  }
  return null;
}

export function parseAdapterSnapshot(health: unknown, jobs: unknown): EmmaAdapterSnapshot {
  const record = asRecord(health);
  const checks = asRecord(record?.checks);
  const codex = asRecord(checks?.codex);
  return {
    ok: record?.ok === true,
    status: asString(record?.status),
    isolationEnforced: checks?.isolationEnforced === true,
    isolationMode: asString(checks?.isolationMode),
    codexEnabled: codex?.enabled === true,
    latestPytest: latestPytestJob(jobs),
  };
}

export function extractJobId(payload: unknown): string | null {
  const record = asRecord(payload);
  const choice = Array.isArray(record?.choices) ? asRecord(record.choices[0]) : null;
  const message = asRecord(choice?.message);
  const content = typeof message?.content === "string" ? message.content : "";
  const match = content.match(/job-[0-9a-f-]{36}/i);
  return match ? match[0] : null;
}

export function buildForecastPytestRequest(runtimeUrl: string): {
  runtimeUrl: string;
  pathname: "/v1/chat/completions";
  method: "POST";
  body: {
    model: "finactiva";
    stream: false;
    session_id: typeof EMMA_SESSION_ID;
    messages: [{ role: "user"; content: typeof FORECAST_PYTEST_INSTRUCTION }];
  };
} {
  return {
    runtimeUrl: assertLocalAdapterUrl(runtimeUrl),
    pathname: "/v1/chat/completions",
    method: "POST",
    body: {
      model: "finactiva",
      stream: false,
      session_id: EMMA_SESSION_ID,
      messages: [{ role: "user", content: FORECAST_PYTEST_INSTRUCTION }],
    },
  };
}

export async function loadEmmaAdapterSnapshot(
  runtimeUrl: string,
  request: CustomRuntimeRequest,
  signal?: AbortSignal,
): Promise<EmmaAdapterSnapshot> {
  const base = assertLocalAdapterUrl(runtimeUrl);
  const health = await request({ runtimeUrl: base, pathname: "/health", method: "GET", signal });
  const jobs = await request({ runtimeUrl: base, pathname: "/jobs", method: "GET", signal });
  return parseAdapterSnapshot(health, jobs);
}

export async function runEmmaForecastPytest(
  runtimeUrl: string,
  request: CustomRuntimeRequest,
  signal?: AbortSignal,
): Promise<{ jobId: string | null; job: EmmaPytestJob | null; snapshot: EmmaAdapterSnapshot }> {
  const call = buildForecastPytestRequest(runtimeUrl);
  const completion = await request({ ...call, signal });
  const jobId = extractJobId(completion);
  const health = await request({
    runtimeUrl: call.runtimeUrl,
    pathname: "/health",
    method: "GET",
    signal,
  });
  let job: EmmaPytestJob | null = null;
  if (jobId) {
    const detail = await request({
      runtimeUrl: call.runtimeUrl,
      pathname: `/jobs/${jobId}`,
      method: "GET",
      signal,
    });
    job = parseJobPayload(detail);
  }
  const jobs = await request({
    runtimeUrl: call.runtimeUrl,
    pathname: "/jobs",
    method: "GET",
    signal,
  });
  const snapshot = parseAdapterSnapshot(health, jobs);
  if (!job && jobId && snapshot.latestPytest?.jobId === jobId) {
    job = snapshot.latestPytest;
  }
  return { jobId: job?.jobId ?? jobId, job, snapshot };
}

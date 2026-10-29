import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  EMMA_SESSION_ID,
  FORECAST_PYTEST_INSTRUCTION,
  LOCAL_ADAPTER_URL,
  assertLocalAdapterUrl,
  buildForecastPytestRequest,
  extractJobId,
  isEmmaSelection,
  jobPhase,
  loadEmmaAdapterSnapshot,
  parseAdapterSnapshot,
  runEmmaForecastPytest,
  type CustomRuntimeRequest,
} from "@/lib/finactiva/emmaQaClient";

const health = {
  ok: true,
  status: "ok",
  checks: {
    isolationEnforced: true,
    isolationMode: "unshare-rm-ro-bind+setpriv-dropcaps+prlimit",
    codex: { enabled: true, auth: "os-user-profile-only", bin: "/usr/bin/codex" },
    secret: "must-not-surface",
  },
};

const pytestJob = {
  jobId: "job-614b9bf8-a602-4f8d-9e8d-d2dabe03380e",
  type: "forecast_pytest",
  status: "PASSED",
  passed: 80,
  failed: null,
  skipped: 6,
  durationMs: 5252,
  summary: "80 passed, 6 skipped in 2.71s",
  isolationMode: "unshare-rm-ro-bind+setpriv-dropcaps+prlimit",
  exitCode: 0,
  createdAt: "2026-10-29T13:35:00.000Z",
  argv: ["must-not-be-required"],
};

describe("emma QA client", () => {
  it("recognizes Emma and leaves other agents alone", () => {
    expect(isEmmaSelection({ id: "qa", name: "Emma" })).toBe(true);
    expect(isEmmaSelection({ id: "agent:qa:main", name: "Emma" })).toBe(true);
    expect(isEmmaSelection({ id: "desk-9", name: "Emma" })).toBe(true);
    expect(isEmmaSelection({ id: "orquestador", name: "Lucas" })).toBe(false);
    expect(isEmmaSelection({ id: "backend", name: "Eva" })).toBe(false);
  });

  it("accepts only localhost http", () => {
    expect(assertLocalAdapterUrl("http://127.0.0.1:7770")).toBe(LOCAL_ADAPTER_URL);
    expect(assertLocalAdapterUrl("http://localhost:7770/")).toBe("http://localhost:7770");
    expect(() => assertLocalAdapterUrl("http://0.0.0.0:7770")).toThrow(/localhost/);
    expect(() => assertLocalAdapterUrl("https://127.0.0.1:7770")).toThrow(/http/);
    expect(() => assertLocalAdapterUrl("http://192.168.1.20:7770")).toThrow(/localhost/);
  });

  it("maps adapter job statuses without treating missing counts as zero", () => {
    expect(jobPhase("QUEUED")).toBe("pending");
    expect(jobPhase("RUNNING")).toBe("running");
    expect(jobPhase("PASSED")).toBe("completed");
    expect(jobPhase("FAILED")).toBe("error");
    expect(jobPhase("TIMEOUT")).toBe("error");
    expect(jobPhase("ERROR")).toBe("error");
    expect(jobPhase("CANCELLED")).toBe("error");
    const snapshot = parseAdapterSnapshot(health, { jobs: [pytestJob] });
    expect(snapshot.codexEnabled).toBe(true);
    expect(snapshot.latestPytest?.failed).toBeNull();
    expect(snapshot.latestPytest?.passed).toBe(80);
    expect(snapshot.latestPytest?.skipped).toBe(6);
    expect(JSON.stringify(snapshot)).not.toContain("must-not-surface");
    expect(JSON.stringify(snapshot)).not.toContain("must-not-be-required");
  });

  it("sends only the allowlisted Emma pytest request", async () => {
    const calls: Array<{ pathname: string; method?: string; body?: unknown }> = [];
    const request: CustomRuntimeRequest = async (input) => {
      calls.push({ pathname: input.pathname, method: input.method, body: input.body });
      if (input.pathname === "/v1/chat/completions") {
        return {
          choices: [{ message: { content: `PASSED\njobId: ${pytestJob.jobId}` } }],
        };
      }
      if (input.pathname === `/jobs/${pytestJob.jobId}`) return { job: pytestJob };
      if (input.pathname === "/health") return health;
      if (input.pathname === "/jobs") return { jobs: [pytestJob] };
      throw new Error(`unexpected ${input.pathname}`);
    };

    const built = buildForecastPytestRequest("http://127.0.0.1:7770");
    expect(built.body).toEqual({
      model: "finactiva",
      stream: false,
      session_id: EMMA_SESSION_ID,
      messages: [{ role: "user", content: FORECAST_PYTEST_INSTRUCTION }],
    });

    const result = await runEmmaForecastPytest(LOCAL_ADAPTER_URL, request);
    expect(result.job?.jobId).toBe(pytestJob.jobId);
    expect(result.job?.phase).toBe("completed");
    expect(calls.map((call) => call.pathname)).toEqual([
      "/v1/chat/completions",
      "/health",
      `/jobs/${pytestJob.jobId}`,
      "/jobs",
    ]);
    expect(calls.some((call) => JSON.stringify(call.body ?? "").includes("codex"))).toBe(false);
    expect(calls.some((call) => JSON.stringify(call.body ?? "").includes("forecast_ai_review"))).toBe(
      false,
    );
  });

  it("reports an incomplete result when the adapter omits the job", async () => {
    const request: CustomRuntimeRequest = async (input) => {
      if (input.pathname === "/v1/chat/completions") {
        return { choices: [{ message: { content: "sin identificador" } }] };
      }
      if (input.pathname === "/health") return health;
      if (input.pathname === "/jobs") return { jobs: [] };
      throw new Error(`unexpected ${input.pathname}`);
    };
    const result = await runEmmaForecastPytest(LOCAL_ADAPTER_URL, request);
    expect(extractJobId({ choices: [{ message: { content: "sin identificador" } }] })).toBeNull();
    expect(result.job).toBeNull();
  });

  it("does not call the adapter when the URL is not local", async () => {
    const request: CustomRuntimeRequest = async () => {
      throw new Error("request should not run");
    };
    await expect(loadEmmaAdapterSnapshot("http://10.1.1.5:7770", request)).rejects.toThrow(
      /localhost/,
    );
  });

  it("surfaces a refused connection", async () => {
    const request: CustomRuntimeRequest = async () => {
      throw new Error("Custom runtime request failed (502) for /health.");
    };
    await expect(loadEmmaAdapterSnapshot(LOCAL_ADAPTER_URL, request)).rejects.toThrow(/502/);
  });

  it("surfaces an aborted run as a thrown error", async () => {
    const controller = new AbortController();
    controller.abort();
    const request: CustomRuntimeRequest = async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    };
    await expect(runEmmaForecastPytest(LOCAL_ADAPTER_URL, request, controller.signal)).rejects.toThrow(
      /aborted/i,
    );
  });

  it("does not contain a Codex execution call", () => {
    const client = readFileSync(path.join(process.cwd(), "src/lib/finactiva/emmaQaClient.ts"), "utf8");
    const panel = readFileSync(
      path.join(process.cwd(), "src/features/office/components/panels/EmmaQaPanel.tsx"),
      "utf8",
    );
    expect(client.includes("forecast_ai_review")).toBe(false);
    expect(panel.includes("runEmmaForecastPytest")).toBe(true);
    expect(panel.includes("disabled")).toBe(true);
    expect(panel.includes("Ejecutar análisis Codex")).toBe(true);
    const labelAt = panel.indexOf("Ejecutar análisis Codex");
    const buttonAt = panel.lastIndexOf("<button", labelAt);
    const codexButton = panel.slice(buttonAt, panel.indexOf("</button>", labelAt));
    expect(codexButton.includes("disabled")).toBe(true);
    expect(codexButton.includes("onClick")).toBe(false);
  });
});

const live = process.env.FINACTIVA_EMMA_QA_LIVE === "1";

describe.skipIf(!live)("emma QA live adapter", () => {
  it(
    "runs one real forecast_pytest and reads the JobResult",
    async () => {
      const calls: string[] = [];
      const request: CustomRuntimeRequest = async (input) => {
        calls.push(`${input.method ?? "GET"} ${input.pathname}`);
        if (input.body) {
          const encoded = JSON.stringify(input.body);
          expect(encoded.includes("forecast_ai_review")).toBe(false);
          expect(encoded.includes("Codex")).toBe(false);
        }
        const response = await fetch(`${input.runtimeUrl}${input.pathname}`, {
          method: input.method ?? "GET",
          headers: input.method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: input.method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
          signal: input.signal,
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${response.status} ${input.pathname}`);
        return JSON.parse(text) as unknown;
      };

      const result = await runEmmaForecastPytest(LOCAL_ADAPTER_URL, request);
      expect(result.job?.phase).toBe("completed");
      expect(result.job?.passed).toBeGreaterThan(0);
      expect(result.job?.skipped).not.toBeNull();
      expect(result.job?.failed).toBeNull();
      expect(result.job?.isolationMode).toContain("unshare");
      expect(calls[0]).toBe("POST /v1/chat/completions");
      expect(calls.some((call) => call.startsWith("GET /jobs/job-"))).toBe(true);
      expect(calls.some((call) => call.includes("codex"))).toBe(false);
    },
    180_000,
  );
});

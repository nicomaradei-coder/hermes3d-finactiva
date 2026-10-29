"use client";

import { useCallback, useEffect, useState } from "react";

import { requestCustomRuntime } from "@/lib/runtime/custom/http";
import {
  LOCAL_ADAPTER_URL,
  loadEmmaAdapterSnapshot,
  runEmmaForecastPytest,
  type EmmaAdapterSnapshot,
  type EmmaJobPhase,
  type EmmaPytestJob,
} from "@/lib/finactiva/emmaQaClient";

const PHASE_LABEL: Record<EmmaJobPhase, string> = {
  pending: "pendiente",
  running: "ejecutando",
  completed: "completado",
  error: "error",
  unknown: "incompleto",
};

function countLabel(value: number | null): string {
  return value === null ? "—" : String(value);
}

function durationLabel(durationMs: number | null): string {
  if (durationMs === null) return "—";
  return `${(durationMs / 1000).toFixed(2)} s`;
}

function JobFacts({ job, title }: { job: EmmaPytestJob; title: string }) {
  return (
    <div className="rounded-xl border border-amber-900/30 bg-black/30 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">
        {title}
      </div>
      <div className="mt-2 font-mono text-sm text-amber-50">{PHASE_LABEL[job.phase]}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[11px] text-amber-100/80">
        <div className="col-span-2">
          <dt className="text-amber-200/45">job</dt>
          <dd className="break-all">{job.jobId}</dd>
        </div>
        <div>
          <dt className="text-amber-200/45">aprobados</dt>
          <dd>{countLabel(job.passed)}</dd>
        </div>
        <div>
          <dt className="text-amber-200/45">fallidos</dt>
          <dd>{countLabel(job.failed)}</dd>
        </div>
        <div>
          <dt className="text-amber-200/45">omitidos</dt>
          <dd>{countLabel(job.skipped)}</dd>
        </div>
        <div>
          <dt className="text-amber-200/45">duración</dt>
          <dd>{durationLabel(job.durationMs)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function EmmaQaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<EmmaAdapterSnapshot | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runJob, setRunJob] = useState<EmmaPytestJob | null>(null);
  const [runJobId, setRunJobId] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const next = await loadEmmaAdapterSnapshot(LOCAL_ADAPTER_URL, requestCustomRuntime, signal);
    setSnapshot(next);
    setConnectionError(null);
    return next;
  }, []);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void refresh(controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setConnectionError(error instanceof Error ? error.message : "No se pudo contactar el adapter.");
    });
    return () => controller.abort();
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !running) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        /* The run request reports the connection failure. */
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, refresh, running]);

  const runPytest = useCallback(async () => {
    setRunning(true);
    setIncomplete(false);
    setRunJob(null);
    setRunJobId(null);
    setEvidenceOpen(false);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 150_000);
    try {
      const result = await runEmmaForecastPytest(
        LOCAL_ADAPTER_URL,
        requestCustomRuntime,
        controller.signal,
      );
      setSnapshot(result.snapshot);
      setRunJobId(result.jobId);
      setRunJob(result.job);
      setIncomplete(!result.job);
      setConnectionError(null);
    } catch (error) {
      const aborted = controller.signal.aborted;
      setConnectionError(
        aborted
          ? "La ejecución superó el tiempo de espera."
          : error instanceof Error
            ? error.message
            : "No se pudo ejecutar forecast_pytest.",
      );
    } finally {
      window.clearTimeout(timer);
      setRunning(false);
    }
  }, []);

  if (!open) return null;

  const liveJob = snapshot?.latestPytest ?? null;
  const shownJob = runJob ?? (running ? liveJob : null);
  const shownPhase: EmmaJobPhase | null = running
    ? shownJob
      ? shownJob.phase === "completed" || shownJob.phase === "error"
        ? "running"
        : shownJob.phase
      : "running"
    : shownJob
      ? shownJob.phase
      : null;
  const evidenceJob = runJob;

  return (
    <aside
      className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,380px)] flex-col border-l border-amber-900/45 bg-[#120a05]/98 shadow-2xl"
      aria-label="Emma QA"
    >
      <div className="flex items-start justify-between gap-3 border-b border-amber-900/35 px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-200/70">
            Emma QA
          </div>
          <div className="mt-1 text-sm text-amber-50">Forecast pytest en el adapter local</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-amber-900/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100"
        >
          Cerrar
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <div className="font-mono text-[11px] text-amber-100/70">
          {LOCAL_ADAPTER_URL}
          <div className="mt-1">
            adapter {snapshot?.ok ? snapshot.status ?? "ok" : connectionError ? "sin conexión" : "consultando"}
            {snapshot ? ` · aislamiento ${snapshot.isolationEnforced ? "activo" : "no confirmado"}` : ""}
          </div>
        </div>

        {connectionError ? (
          <p className="rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-50">
            {connectionError}
          </p>
        ) : null}

        {shownJob && shownPhase ? (
          <JobFacts job={{ ...shownJob, phase: shownPhase }} title="forecast_pytest" />
        ) : (
          <p className="font-mono text-[11px] text-amber-100/50">
            {running ? "ejecutando" : "Todavía no hay un resultado de esta sesión."}
          </p>
        )}

        {incomplete ? (
          <p className="font-mono text-[11px] text-amber-200/80">
            El adapter respondió sin un JobResult de forecast_pytest.
            {runJobId ? ` Identificador: ${runJobId}` : ""}
          </p>
        ) : null}

        {evidenceJob ? (
          <div>
            <button
              type="button"
              onClick={() => setEvidenceOpen((value) => !value)}
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80"
            >
              {evidenceOpen ? "Ocultar evidencia" : "Ver evidencia"}
            </button>
            {evidenceOpen ? (
              <dl className="mt-2 space-y-2 font-mono text-[11px] text-amber-50/90">
                <div>
                  <dt className="text-amber-200/45">job</dt>
                  <dd className="break-all">{evidenceJob.jobId}</dd>
                </div>
                <div>
                  <dt className="text-amber-200/45">estado</dt>
                  <dd>
                    {evidenceJob.status} · {PHASE_LABEL[evidenceJob.phase]}
                  </dd>
                </div>
                <div>
                  <dt className="text-amber-200/45">resumen</dt>
                  <dd>{evidenceJob.summary ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-amber-200/45">aislamiento</dt>
                  <dd>{evidenceJob.isolationMode ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-amber-200/45">salida</dt>
                  <dd>{evidenceJob.exitCode === null ? "—" : evidenceJob.exitCode}</dd>
                </div>
                {evidenceJob.errorSummary ? (
                  <div>
                    <dt className="text-amber-200/45">error</dt>
                    <dd>{evidenceJob.errorSummary}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        ) : null}

        {!running && liveJob && liveJob.jobId !== runJob?.jobId ? (
          <JobFacts job={liveJob} title="último forecast_pytest" />
        ) : null}

        <div className="rounded-xl border border-amber-900/30 bg-black/20 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/70">
            Codex
          </div>
          <p className="mt-2 text-sm text-amber-50/85">
            {snapshot?.codexEnabled
              ? "Análisis disponible en el adapter."
              : "Análisis no habilitado en el adapter."}{" "}
            La ejecución queda pendiente de una autorización humana separada.
          </p>
          <button
            type="button"
            disabled
            className="mt-3 cursor-not-allowed rounded-lg border border-amber-900/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100/40"
          >
            Ejecutar análisis Codex
          </button>
        </div>
      </div>

      <div className="border-t border-amber-900/35 px-4 py-3">
        <button
          type="button"
          disabled={running}
          onClick={() => void runPytest()}
          className="w-full rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-50 disabled:opacity-50"
        >
          {running ? "ejecutando" : "Ejecutar forecast_pytest"}
        </button>
      </div>
    </aside>
  );
}

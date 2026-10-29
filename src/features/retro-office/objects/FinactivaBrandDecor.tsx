"use client";

/**
 * Physical FINACTIVA BUSINESS wall sign + roadmap wall screen.
 * Official logo + v2 tokens only. ECO-friendly (MeshBasic / no extra lights).
 */

import { Html, useTexture } from "@react-three/drei";
import { memo, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { FINACTIVA_BRAND } from "@/features/retro-office/core/finactivaBrand";
import { toWorld } from "@/features/retro-office/core/geometry";
import { useObjectShadowsEnabled } from "@/features/retro-office/core/GraphicsQualityContext";
import type {
  FinactivaRoadmapColumn,
  FinactivaRoadmapSnapshot,
  FinactivaRoadmapTask,
} from "@/lib/finactivaRoadmap/types";

const COLUMN_LABEL: Record<FinactivaRoadmapColumn, string> = {
  backlog: "BACKLOG",
  in_progress: "IN PROGRESS",
  blocked_review: "BLOCKED / REVIEW",
  done: "DONE",
};

const COLUMN_ORDER: FinactivaRoadmapColumn[] = [
  "backlog",
  "in_progress",
  "blocked_review",
  "done",
];

function useSignTexture(label: string, subtitle: string) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = FINACTIVA_BRAND.navy;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = FINACTIVA_BRAND.green;
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
    ctx.fillStyle = FINACTIVA_BRAND.page;
    ctx.font = "700 72px Manrope, Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 210, 110);
    ctx.fillStyle = FINACTIVA_BRAND.cyan;
    ctx.font = "500 28px Manrope, Inter, system-ui, sans-serif";
    ctx.fillText(subtitle, 210, 175);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [label, subtitle]);
}

function useRoadmapTexture(snapshot: FinactivaRoadmapSnapshot | null) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = FINACTIVA_BRAND.navyDeep;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = FINACTIVA_BRAND.green;
    ctx.fillRect(0, 0, canvas.width, 6);
    ctx.fillStyle = FINACTIVA_BRAND.page;
    ctx.font = "700 36px Manrope, Inter, system-ui, sans-serif";
    ctx.fillText("FINACTIVA BUSINESS — ROADMAP", 28, 48);

    const tasks = snapshot?.tasks ?? [];
    if (!snapshot || tasks.length === 0) {
      ctx.fillStyle = FINACTIVA_BRAND.muted;
      ctx.font = "500 28px Manrope, Inter, system-ui, sans-serif";
      ctx.fillText(
        snapshot?.emptyReason ?? "Roadmap pendiente de sincronización",
        28,
        320,
      );
    } else {
      const colW = (canvas.width - 56) / 4;
      COLUMN_ORDER.forEach((column, index) => {
        const x = 28 + index * colW;
        ctx.fillStyle = FINACTIVA_BRAND.slate200;
        ctx.font = "700 18px Manrope, Inter, system-ui, sans-serif";
        ctx.fillText(COLUMN_LABEL[column], x, 90);
        const colTasks = tasks
          .filter((task) => task.column === column)
          .slice(0, 5);
        colTasks.forEach((task, row) => {
          const y = 120 + row * 90;
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(x, y, colW - 16, 78);
          ctx.strokeStyle = FINACTIVA_BRAND.green;
          ctx.strokeRect(x, y, colW - 16, 78);
          ctx.fillStyle = FINACTIVA_BRAND.cyan;
          ctx.font = "600 14px Manrope, Inter, system-ui, sans-serif";
          ctx.fillText(task.id.slice(0, 18), x + 8, y + 22);
          ctx.fillStyle = FINACTIVA_BRAND.page;
          ctx.font = "500 13px Manrope, Inter, system-ui, sans-serif";
          ctx.fillText(task.name.slice(0, 22), x + 8, y + 44);
          ctx.fillStyle = FINACTIVA_BRAND.muted;
          ctx.font = "400 11px Manrope, Inter, system-ui, sans-serif";
          ctx.fillText(task.status.slice(0, 28), x + 8, y + 64);
        });
      });
    }

    if (snapshot?.syncedAt) {
      ctx.fillStyle = FINACTIVA_BRAND.muted;
      ctx.font = "400 12px Manrope, Inter, system-ui, sans-serif";
      ctx.fillText(`Synced ${snapshot.syncedAt}`, 28, canvas.height - 18);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }, [snapshot]);
}

const BusinessSign = memo(function BusinessSign({
  position,
  rotY,
}: {
  position: [number, number, number];
  rotY: number;
}) {
  const castShadow = useObjectShadowsEnabled();
  const plate = useSignTexture("FINACTIVA BUSINESS", "Financial Intelligence");
  const logo = useTexture(FINACTIVA_BRAND.logoSrc);

  useEffect(() => {
    logo.colorSpace = THREE.SRGBColorSpace;
    logo.needsUpdate = true;
  }, [logo]);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, -0.02]} castShadow={castShadow}>
        <boxGeometry args={[1.85, 0.55, 0.04]} />
        <meshStandardMaterial
          color={FINACTIVA_BRAND.navy}
          roughness={0.55}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[1.78, 0.48]} />
        <meshBasicMaterial map={plate} toneMapped={false} />
      </mesh>
      <mesh position={[-0.72, 0.02, 0.01]}>
        <planeGeometry args={[0.28, 0.28]} />
        <meshBasicMaterial map={logo} toneMapped={false} transparent />
      </mesh>
      <mesh position={[0, -0.24, 0.02]}>
        <boxGeometry args={[1.78, 0.02, 0.01]} />
        <meshBasicMaterial color={FINACTIVA_BRAND.green} toneMapped={false} />
      </mesh>
    </group>
  );
});

const RoadmapWallScreen = memo(function RoadmapWallScreen({
  position,
  rotY,
  snapshot,
  onSelect,
}: {
  position: [number, number, number];
  rotY: number;
  snapshot: FinactivaRoadmapSnapshot | null;
  onSelect: () => void;
}) {
  const castShadow = useObjectShadowsEnabled();
  const screen = useRoadmapTexture(snapshot);

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, -0.03]} castShadow={castShadow}>
        <boxGeometry args={[2.35, 1.45, 0.06]} />
        <meshStandardMaterial
          color={FINACTIVA_BRAND.navy}
          roughness={0.4}
          metalness={0.25}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.01]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <planeGeometry args={[2.2, 1.32]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      <Html position={[0, -0.82, 0.05]} center style={{ pointerEvents: "none" }}>
        <div
          style={{
            fontSize: 10,
            color: FINACTIVA_BRAND.page,
            background: "rgba(15,23,42,0.85)",
            border: `1px solid ${FINACTIVA_BRAND.green}55`,
            padding: "2px 8px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            fontFamily: "Manrope, Inter, system-ui, sans-serif",
          }}
        >
          Click to expand roadmap
        </div>
      </Html>
    </group>
  );
});

export const FinactivaRoadmapPanel = memo(function FinactivaRoadmapPanel({
  open,
  snapshot,
  loading,
  error,
  onClose,
  onRefresh,
}: {
  open: boolean;
  snapshot: FinactivaRoadmapSnapshot | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  if (!open) return null;
  const tasks = snapshot?.tasks ?? [];
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-[#020617]/55 p-4 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0f172a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-emerald-500/20 px-5 py-3">
          <div>
            <div className="text-sm font-bold tracking-[0.14em] text-emerald-300">
              FINACTIVA BUSINESS — ROADMAP
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Source: docs/ROADMAP.md
              {snapshot?.syncedAt
                ? ` · Synced ${new Date(snapshot.syncedAt).toLocaleString()}`
                : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-500/40 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-500/10"
            >
              Close
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto p-4">
          {loading ? (
            <p className="text-sm text-slate-300">Loading roadmap…</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-300">
              {snapshot?.emptyReason ??
                "Roadmap pendiente de sincronización"}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              {COLUMN_ORDER.map((column) => (
                <div key={column} className="rounded-xl bg-[#020617]/70 p-3">
                  <div className="mb-2 text-[10px] font-bold tracking-[0.16em] text-emerald-300/90">
                    {COLUMN_LABEL[column]}
                  </div>
                  <div className="space-y-2">
                    {tasks
                      .filter((task) => task.column === column)
                      .map((task) => (
                        <RoadmapCard key={task.id} task={task} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function RoadmapCard({ task }: { task: FinactivaRoadmapTask }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-[#0f172a] p-2">
      <div className="text-[10px] font-semibold text-cyan-300">{task.id}</div>
      <div className="mt-0.5 text-xs text-slate-100">{task.name}</div>
      <div className="mt-1 text-[10px] text-slate-400">{task.status}</div>
      <div className="mt-1 flex gap-2 text-[10px] text-slate-500">
        <span>Owner: {task.owner ?? "—"}</span>
        <span>Priority: {task.priority ?? "—"}</span>
      </div>
    </div>
  );
}

export const FinactivaBrandDecor = memo(function FinactivaBrandDecor({
  onOpenRoadmap,
  snapshot,
}: {
  onOpenRoadmap: () => void;
  snapshot: FinactivaRoadmapSnapshot | null;
}) {
  const [signX, , northZ] = toWorld(420, 12);
  const [boardX] = toWorld(760, 12);

  return (
    <group>
      <BusinessSign position={[signX, 1.15, northZ + 0.06]} rotY={0} />
      <RoadmapWallScreen
        position={[boardX, 1.05, northZ + 0.06]}
        rotY={0}
        snapshot={snapshot}
        onSelect={onOpenRoadmap}
      />
    </group>
  );
});

export function useFinactivaRoadmap(): {
  snapshot: FinactivaRoadmapSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [snapshot, setSnapshot] = useState<FinactivaRoadmapSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/finactiva-roadmap", {
          cache: "no-store",
        });
        const data = (await response.json()) as FinactivaRoadmapSnapshot;
        if (!cancelled) setSnapshot(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Roadmap fetch failed",
          );
          setSnapshot({
            source: "docs/ROADMAP.md",
            title: "FINACTIVA BUSINESS — ROADMAP",
            syncedAt: null,
            tasks: [],
            emptyReason: "Roadmap pendiente de sincronización",
            error: "fetch_failed",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useMemo(
    () => () => setTick((value) => value + 1),
    [],
  );

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
}

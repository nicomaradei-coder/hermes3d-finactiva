import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseFinactivaRoadmapMarkdown } from "@/lib/finactivaRoadmap/parseRoadmapMd";
import type { FinactivaRoadmapSnapshot } from "@/lib/finactivaRoadmap/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANDIDATE_PATHS = [
  // Monorepo checkout (cloud agent / local workspace).
  path.resolve(process.cwd(), "..", "docs", "ROADMAP.md"),
  path.resolve(process.cwd(), "docs", "ROADMAP.md"),
  // Nested pilot under /workspace
  path.resolve("/workspace/docs/ROADMAP.md"),
];

const buildEmpty = (
  reason: string,
  error: string | null = null,
): FinactivaRoadmapSnapshot => ({
  source: "docs/ROADMAP.md",
  title: "FINACTIVA BUSINESS — ROADMAP",
  syncedAt: null,
  tasks: [],
  emptyReason: reason,
  error,
});

export async function GET() {
  let lastError: string | null = null;
  for (const filePath of CANDIDATE_PATHS) {
    try {
      const markdown = await readFile(filePath, "utf8");
      const tasks = parseFinactivaRoadmapMarkdown(markdown);
      if (tasks.length === 0) {
        return NextResponse.json(
          buildEmpty("Roadmap pendiente de sincronización"),
        );
      }
      const snapshot: FinactivaRoadmapSnapshot = {
        source: "docs/ROADMAP.md",
        title: "FINACTIVA BUSINESS — ROADMAP",
        syncedAt: new Date().toISOString(),
        tasks,
        emptyReason: null,
        error: null,
      };
      return NextResponse.json(snapshot, {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Roadmap file unreadable";
    }
  }
  return NextResponse.json(
    buildEmpty("Roadmap pendiente de sincronización", lastError),
    { status: 200 },
  );
}

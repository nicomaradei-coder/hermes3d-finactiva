export type FinactivaRoadmapColumn =
  | "backlog"
  | "in_progress"
  | "blocked_review"
  | "done";

export type FinactivaRoadmapTask = {
  id: string;
  name: string;
  owner: string | null;
  status: string;
  priority: string | null;
  column: FinactivaRoadmapColumn;
};

export type FinactivaRoadmapSnapshot = {
  source: "docs/ROADMAP.md";
  title: "FINACTIVA BUSINESS — ROADMAP";
  syncedAt: string | null;
  tasks: FinactivaRoadmapTask[];
  emptyReason: string | null;
  error: string | null;
};

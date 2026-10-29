import type {
  FinactivaRoadmapColumn,
  FinactivaRoadmapTask,
} from "@/lib/finactivaRoadmap/types";

/**
 * Parse the live engineering table from Finactiva `docs/ROADMAP.md`.
 * Status strings are owner-stated in that file — never invent rows.
 */
export const classifyRoadmapStatus = (
  statusRaw: string,
): FinactivaRoadmapColumn => {
  const status = statusRaw.replace(/\*\*/g, "").trim().toLowerCase();

  if (
    status.includes("not yet production") ||
    status.includes("production smoke not recorded") ||
    status.includes("not complete in production") ||
    status.includes("superseded")
  ) {
    return "blocked_review";
  }

  if (
    status.includes("complete in production") ||
    status.includes("shipped / production") ||
    status.startsWith("complete") ||
    status.startsWith("shipped")
  ) {
    return "done";
  }

  if (
    status.includes("merged") ||
    status.includes("implemented") ||
    status.includes("in progress") ||
    status.includes("active")
  ) {
    return "in_progress";
  }

  return "backlog";
};

const ROW_RE =
  /^\|\s*(V[\d.]+(?:\s+[A-Za-z][\w -/]*)?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;

export const parseFinactivaRoadmapMarkdown = (
  markdown: string,
): FinactivaRoadmapTask[] => {
  const tasks: FinactivaRoadmapTask[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*-+/.test(trimmed)) continue;
    if (/^\|\s*Version\s*\|/i.test(trimmed)) continue;
    const match = trimmed.match(ROW_RE);
    if (!match) continue;
    const id = match[1]!.trim().replace(/\s+/g, " ");
    const name = match[2]!.trim();
    const status = match[3]!.trim().replace(/\*\*/g, "");
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    tasks.push({
      id,
      name,
      owner: null,
      status,
      priority: id.startsWith("V44")
        ? "P0"
        : id.startsWith("V43")
          ? "P1"
          : "P2",
      column: classifyRoadmapStatus(status),
    });
  }
  return tasks;
};

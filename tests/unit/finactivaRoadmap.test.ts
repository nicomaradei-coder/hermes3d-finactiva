import { describe, expect, it } from "vitest";
import {
  classifyRoadmapStatus,
  parseFinactivaRoadmapMarkdown,
} from "@/lib/finactivaRoadmap/parseRoadmapMd";

describe("finactiva roadmap parser", () => {
  it("classifies owner-stated statuses without inventing rows", () => {
    expect(classifyRoadmapStatus("COMPLETE IN PRODUCTION")).toBe("done");
    expect(classifyRoadmapStatus("SHIPPED / PRODUCTION")).toBe("done");
    expect(
      classifyRoadmapStatus(
        "MERGED TO MAIN (PR #31). Production smoke not recorded.",
      ),
    ).toBe("blocked_review");
    expect(
      classifyRoadmapStatus("IMPLEMENTED / NOT YET PRODUCTION (DEC-039)."),
    ).toBe("blocked_review");
    expect(classifyRoadmapStatus("MERGED (PR #35, DEC-037).")).toBe(
      "in_progress",
    );
  });

  it("parses the version table only", () => {
    const md = `
| Version | Name | Status |
|---|---|---|
| V42.9 | Safety Baseline | **COMPLETE** |
| V43.0.16 | Canonical Financial Copilot | **MERGED TO MAIN (PR #31). Production smoke not recorded.** |
| V44 final navigation | Final product navigation | **IMPLEMENTED / NOT YET PRODUCTION (DEC-039).** |
`;
    const tasks = parseFinactivaRoadmapMarkdown(md);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      id: "V42.9",
      name: "Safety Baseline",
      column: "done",
      owner: null,
    });
    expect(tasks[1]?.column).toBe("blocked_review");
    expect(tasks[2]?.column).toBe("blocked_review");
  });
});

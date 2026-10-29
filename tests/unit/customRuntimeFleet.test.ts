import { describe, expect, it } from "vitest";

import { buildOfficeCanvasResetKey } from "@/features/retro-office/core/canvasResetKey";
import {
  commandsForFleetApply,
  FLEET_SYNC_TIMEOUT_MS,
  fleetHydrationAccepted,
  isOfficeSceneReady,
  raceWithTimeout,
  type StudioBootstrapLoadCommand,
} from "@/features/agents/operations/studioBootstrapOperation";
import {
  listCustomRuntimeAgents,
  resolveCustomRuntimeFleet,
} from "@/lib/runtime/custom/provider";

const adapterAgents = [
  { id: "nicolas", name: "Nicolás", role: "CEO / Product Owner", status: "idle" },
  { id: "orquestador", name: "Lucas", role: "Orquestador", status: "idle" },
  { id: "arquitecto", name: "Luna", role: "Arquitecto", status: "idle" },
  { id: "guardian-financiero", name: "Leo", role: "Guardián financiero", status: "idle" },
  { id: "frontend", name: "Martina", role: "Frontend", status: "idle" },
  { id: "backend", name: "Eva", role: "Backend", status: "idle" },
  { id: "qa", name: "Emma", role: "QA", status: "idle" },
  { id: "seguridad", name: "Theo", role: "Seguridad", status: "idle" },
  { id: "integrador-pr", name: "Bruno", role: "Integrador PR", status: "idle" },
  { id: "docs-release", name: "Clara", role: "Docs/Release", status: "idle" },
];

describe("custom runtime fleet sync", () => {
  it("maps a connected adapter registry into the real roster, including Emma", () => {
    const listed = listCustomRuntimeAgents(
      { agents: adapterAgents, active: { qa: "finactiva" } },
      { agents: adapterAgents },
    );

    expect(listed.map((agent) => agent.id)).toEqual(adapterAgents.map((agent) => agent.id));
    expect(listed.find((agent) => agent.id === "qa")).toMatchObject({
      name: "Emma",
      role: "QA",
      status: "idle",
    });
    expect(listed.some((agent) => agent.id === "main")).toBe(false);
  });

  it("does not treat a failed agents.list as a synced empty roster", () => {
    const failed: StudioBootstrapLoadCommand[] = [
      { kind: "set-error", message: "Custom runtime request failed (502) for /state." },
    ];
    const synced: StudioBootstrapLoadCommand[] = [
      {
        kind: "hydrate-agents",
        seeds: adapterAgents.map((agent) => ({
          agentId: agent.id,
          name: agent.name,
          sessionKey: `agent:${agent.id}:main`,
        })),
        initialSelectedAgentId: "qa",
      },
    ];

    expect(fleetHydrationAccepted(failed)).toBe(false);
    expect(fleetHydrationAccepted(synced)).toBe(true);
    expect(fleetHydrationAccepted([...synced, ...failed])).toBe(false);
    expect(
      fleetHydrationAccepted([
        {
          kind: "hydrate-agents",
          seeds: [],
          initialSelectedAgentId: undefined,
        },
      ]),
    ).toBe(false);
    expect(commandsForFleetApply([...synced, ...failed], false)).toEqual(failed);
    expect(commandsForFleetApply(synced, true)).toEqual(synced);
  });

  it("prefers state.agents and falls back to registry.agents without inventing main", () => {
    const stateAgents = adapterAgents.map((agent) =>
      agent.id === "qa" ? { ...agent, name: "Emma" } : agent,
    );
    const registryAgents = [{ id: "other", name: "Other", role: "Other", status: "idle" }];
    const preferred = resolveCustomRuntimeFleet(
      { agents: stateAgents, active: { qa: "finactiva" } },
      { agents: registryAgents },
    );
    expect(preferred.source).toBe("state");
    expect(preferred.agents.find((agent) => agent.id === "qa")?.name).toBe("Emma");
    expect(preferred.agents.some((agent) => agent.id === "other")).toBe(false);

    const fromRegistry = resolveCustomRuntimeFleet(
      { active: { qa: "finactiva" } },
      { agents: adapterAgents },
    );
    expect(fromRegistry.source).toBe("registry");
    expect(fromRegistry.agents.map((agent) => agent.id)).toEqual(
      adapterAgents.map((agent) => agent.id),
    );

    const emptyExplicit = resolveCustomRuntimeFleet({ agents: [] }, { agents: [] });
    expect(emptyExplicit).toEqual({ agents: [], source: "none" });
    expect(resolveCustomRuntimeFleet(null, null)).toEqual({ agents: [], source: "none" });
  });

  it("keeps the office scene unmounted until the roster hydrate is accepted", () => {
    expect(isOfficeSceneReady(false)).toBe(false);
    expect(isOfficeSceneReady(true)).toBe(true);
    const withZeroAgents = buildOfficeCanvasResetKey({
      remoteOfficeEnabled: false,
      gatewayStatus: "connected",
      officeCenterSignal: 0,
    });
    const withFleet = buildOfficeCanvasResetKey({
      remoteOfficeEnabled: false,
      gatewayStatus: "connected",
      officeCenterSignal: 0,
    });
    expect(withFleet).toBe(withZeroAgents);
    expect(withFleet).not.toContain("10");
  });

  it("rejects a hung agents.list instead of treating it as a loaded roster", async () => {
    await expect(
      raceWithTimeout(
        new Promise(() => {}),
        15,
        "La sincronización del roster superó el tiempo de espera.",
      ),
    ).rejects.toThrow(/tiempo de espera/);
    expect(FLEET_SYNC_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

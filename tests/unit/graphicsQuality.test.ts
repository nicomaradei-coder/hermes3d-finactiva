import { describe, expect, it } from "vitest";
import {
  GRAPHICS_QUALITY_OPTIONS,
  getGraphicsQualityConfig,
  isGraphicsQuality,
} from "@/features/retro-office/core/graphicsQuality";

describe("graphicsQuality profiles (ECO / BALANCED / HIGH)", () => {
  it("keeps storage ids low|balanced|ultra while UI labels map to ECO/BALANCED/HIGH", () => {
    expect(GRAPHICS_QUALITY_OPTIONS.map((o) => o.id)).toEqual([
      "low",
      "balanced",
      "ultra",
    ]);
    expect(GRAPHICS_QUALITY_OPTIONS.map((o) => o.label)).toEqual([
      "ECO",
      "BALANCED",
      "HIGH",
    ]);
    expect(isGraphicsQuality("low")).toBe(true);
    expect(isGraphicsQuality("eco")).toBe(false);
  });

  it("ECO disables shadows, AA, HDRI, dust, daylight drift and post-FX", () => {
    const eco = getGraphicsQualityConfig("low");
    expect(eco.enableShadows).toBe(false);
    expect(eco.enableObjectShadows).toBe(false);
    expect(eco.enableDistantShadows).toBe(false);
    expect(eco.antialias).toBe(false);
    expect(eco.maxDpr).toBe(1);
    expect(eco.adaptiveDprIntervalFrames).toBeGreaterThanOrEqual(90);
    expect(eco.postProcessing).toBe(false);
    expect(eco.dustMoteCount).toBe(0);
    expect(eco.enableDaylightDrift).toBe(false);
    expect(eco.useHdriEnvironment).toBe(false);
  });

  it("BALANCED uses moderate shadows and capped DPR", () => {
    const bal = getGraphicsQualityConfig("balanced");
    expect(bal.enableShadows).toBe(true);
    expect(bal.shadowMapSize).toBeGreaterThanOrEqual(1024);
    expect(bal.shadowMapSize).toBeLessThanOrEqual(2048);
    expect(bal.maxDpr).toBeLessThanOrEqual(1.5);
    expect(bal.enableDistantShadows).toBe(false);
    expect(bal.dustMoteCount).toBeGreaterThan(0);
    expect(bal.dustMoteCount).toBeLessThanOrEqual(80);
    expect(bal.postProcessing).toBe(true);
  });

  it("HIGH preserves original ultra fidelity knobs", () => {
    const high = getGraphicsQualityConfig("ultra");
    expect(high.enableShadows).toBe(true);
    expect(high.shadowMapSize).toBe(4096);
    expect(high.maxDpr).toBe(2);
    expect(high.dustMoteCount).toBe(220);
    expect(high.followDepthOfField).toBe(true);
    expect(high.useHdriEnvironment).toBe(true);
    expect(high.enableDaylightDrift).toBe(true);
    expect(high.enableDistantShadows).toBe(true);
  });
});

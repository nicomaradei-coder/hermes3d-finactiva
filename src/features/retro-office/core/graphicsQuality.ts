// Graphics quality presets for the immersive office renderer.
// Persisted in localStorage so the choice survives reloads.
//
// Visual profile mapping (UI labels):
//   low      → ECO
//   balanced → BALANCED
//   ultra    → HIGH
// Storage keys remain "low" | "balanced" | "ultra" for compatibility.

export type GraphicsQuality = "low" | "balanced" | "ultra";

export const GRAPHICS_QUALITY_STORAGE_KEY = "hermes-office-graphics-quality-v1";

export const GRAPHICS_QUALITY_OPTIONS: Array<{
  id: GraphicsQuality;
  label: string;
  description: string;
}> = [
  {
    id: "low",
    label: "ECO",
    description:
      "Notebook-first. No shadows, no post-FX, capped DPR, light lighting.",
  },
  {
    id: "balanced",
    label: "BALANCED",
    description: "Moderate shadows and post-FX. Target up to ~60 FPS.",
  },
  {
    id: "ultra",
    label: "HIGH",
    description: "Original fidelity. Large shadow maps and full effects.",
  },
];

export type GraphicsQualityConfig = {
  /** When false, the WebGL renderer does not allocate or sample shadow maps. */
  enableShadows: boolean;
  /** Shadow map resolution for the key light (ignored when enableShadows is false). */
  shadowMapSize: number;
  /** Distant props (park trees) cast shadows when true. */
  enableDistantShadows: boolean;
  /** Agents / near furniture may cast shadows when true (and enableShadows). */
  enableObjectShadows: boolean;
  /** Canvas MSAA / native antialias. */
  antialias: boolean;
  /** Upper bound for the adaptive device pixel ratio controller. */
  maxDpr: number;
  /** Adaptive DPR sample window (frames between adjustments). */
  adaptiveDprIntervalFrames: number;
  /** Whether the EffectComposer post-processing chain is mounted. */
  postProcessing: boolean;
  /** Screen-space ambient occlusion (N8AO). */
  ambientOcclusion: boolean;
  /** AO quality knob passed to N8AO. */
  aoQuality: "performance" | "low" | "medium" | "high";
  /** Bloom on bright emissive surfaces. */
  bloom: boolean;
  /** SMAA anti-aliasing inside the composer. */
  smaa: boolean;
  /** Depth of field while the follow camera is active. */
  followDepthOfField: boolean;
  /** Dust mote particle count (0 disables the system entirely). */
  dustMoteCount: number;
  /** Slow sun color/position drift. Off in ECO to save CPU. */
  enableDaylightDrift: boolean;
  /**
   * When true, load the HDRI Environment (IBL + sky).
   * When false, use lightweight ambient/hemisphere/directional only.
   */
  useHdriEnvironment: boolean;
};

const QUALITY_CONFIGS: Record<GraphicsQuality, GraphicsQualityConfig> = {
  // ECO — notebook / low GPU
  low: {
    enableShadows: false,
    shadowMapSize: 512,
    enableDistantShadows: false,
    enableObjectShadows: false,
    antialias: false,
    maxDpr: 1,
    adaptiveDprIntervalFrames: 120,
    postProcessing: false,
    ambientOcclusion: false,
    aoQuality: "performance",
    bloom: false,
    smaa: false,
    followDepthOfField: false,
    dustMoteCount: 0,
    enableDaylightDrift: false,
    useHdriEnvironment: false,
  },
  // BALANCED — intermediate
  balanced: {
    enableShadows: true,
    shadowMapSize: 1024,
    enableDistantShadows: false,
    enableObjectShadows: true,
    antialias: true,
    maxDpr: 1.25,
    adaptiveDprIntervalFrames: 60,
    postProcessing: true,
    ambientOcclusion: true,
    aoQuality: "performance",
    bloom: true,
    smaa: true,
    followDepthOfField: false,
    dustMoteCount: 80,
    enableDaylightDrift: true,
    useHdriEnvironment: true,
  },
  // HIGH — original ultra fidelity
  ultra: {
    enableShadows: true,
    shadowMapSize: 4096,
    enableDistantShadows: true,
    enableObjectShadows: true,
    antialias: true,
    maxDpr: 2,
    adaptiveDprIntervalFrames: 45,
    postProcessing: true,
    ambientOcclusion: true,
    aoQuality: "medium",
    bloom: true,
    smaa: true,
    followDepthOfField: true,
    dustMoteCount: 220,
    enableDaylightDrift: true,
    useHdriEnvironment: true,
  },
};

export const getGraphicsQualityConfig = (
  quality: GraphicsQuality,
): GraphicsQualityConfig => QUALITY_CONFIGS[quality];

export const isGraphicsQuality = (value: unknown): value is GraphicsQuality =>
  value === "low" || value === "balanced" || value === "ultra";

/** The explicit user choice, or null when the user never picked one. */
export const loadStoredGraphicsQuality = (): GraphicsQuality | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(GRAPHICS_QUALITY_STORAGE_KEY);
    if (isGraphicsQuality(stored)) return stored;
  } catch {
    // Storage unavailable (private mode, etc.) — fall through to default.
  }
  return null;
};

export const loadGraphicsQuality = (): GraphicsQuality =>
  loadStoredGraphicsQuality() ?? "balanced";

/**
 * True when WebGL runs on a CPU rasterizer (SwiftShader, llvmpipe, …).
 * Software renderers cannot keep up with the full pipeline and may lose
 * the GL context, so callers should drop to the "low" (ECO) preset.
 */
export const isSoftwareWebGLRenderer = (
  context: WebGLRenderingContext | WebGL2RenderingContext,
): boolean => {
  try {
    const debugInfo = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      debugInfo
        ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        : context.getParameter(context.RENDERER),
    );
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    return false;
  }
};

let softwareWebGLProbe: boolean | null = null;

/**
 * Probes a throwaway WebGL context to learn whether the machine rasterizes
 * in software, BEFORE the main canvas mounts. This lets the initial quality
 * state start at "low" on such machines instead of downgrading after the
 * heavy pipeline has already overloaded (and possibly lost) the context.
 */
export const detectSoftwareWebGL = (): boolean => {
  if (typeof document === "undefined") return false;
  if (softwareWebGLProbe !== null) return softwareWebGLProbe;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context =
      canvas.getContext("webgl2") ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!context) {
      softwareWebGLProbe = true;
      return true;
    }
    softwareWebGLProbe = isSoftwareWebGLRenderer(context);
    context.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    softwareWebGLProbe = false;
  }
  return softwareWebGLProbe ?? false;
};

/**
 * The quality the office should boot with: the user's stored choice, or a
 * hardware-appropriate default.
 */
export const resolveInitialGraphicsQuality = (): GraphicsQuality =>
  loadStoredGraphicsQuality() ?? (detectSoftwareWebGL() ? "low" : "balanced");

export const saveGraphicsQuality = (quality: GraphicsQuality) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRAPHICS_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Best effort only.
  }
};

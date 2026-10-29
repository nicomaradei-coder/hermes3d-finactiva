"use client";

import { createContext, useContext } from "react";
import type { GraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";
import { getGraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";

const GraphicsQualityContext = createContext<GraphicsQualityConfig>(
  getGraphicsQualityConfig("balanced"),
);

export const GraphicsQualityProvider = GraphicsQualityContext.Provider;

export const useGraphicsQualityConfig = (): GraphicsQualityConfig =>
  useContext(GraphicsQualityContext);

/** Whether near-field meshes should cast/receive shadows under the active profile. */
export const useObjectShadowsEnabled = (): boolean => {
  const config = useGraphicsQualityConfig();
  return config.enableShadows && config.enableObjectShadows;
};

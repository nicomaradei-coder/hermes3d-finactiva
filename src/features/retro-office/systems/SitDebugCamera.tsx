"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { toWorld } from "@/features/retro-office/core/geometry";

declare global {
  interface Window {
    /** Runtime toggle for side-elevation sit QA without losing the gateway session. */
    __hermesSitDebug?: boolean;
    /** Runtime toggle for close isometric sit QA. */
    __hermesIsoDebug?: boolean;
    /** Runtime toggle for frontal sit QA (along facing, toward the agent). */
    __hermesFrontDebug?: boolean;
    /** Optional canvas-space focus override while sit/iso/front debug is active. */
    __hermesSitDebugFocus?: { x: number; y: number };
    /** Optional facing (radians) for front camera — defaults to desk-row facing. */
    __hermesSitDebugFacing?: number;
  }
}

const resolveFocus = (fallback: { x: number; y: number }) =>
  typeof window !== "undefined" && window.__hermesSitDebugFocus
    ? window.__hermesSitDebugFocus
    : fallback;

export const readSitDebugMode = (): "side" | "iso" | "front" | null => {
  if (typeof window === "undefined") return null;
  try {
    if (
      window.__hermesSitDebug === true ||
      new URLSearchParams(window.location.search).get("sitDebug") === "1"
    ) {
      return "side";
    }
    if (window.__hermesFrontDebug === true) return "front";
    if (window.__hermesIsoDebug === true) return "iso";
  } catch {
    /* ignore */
  }
  return null;
};

/**
 * Debug camera for sit QA.
 * - Side: `?sitDebug=1` or `window.__hermesSitDebug = true`
 * - Iso close-up: `window.__hermesIsoDebug = true`
 * - Front: `window.__hermesFrontDebug = true` (+ optional `__hermesSitDebugFacing`)
 * Focus: `window.__hermesSitDebugFocus = { x, y }` (canvas units).
 *
 * Disables OrbitControls while live so the overview rig cannot fight the focus.
 */
export function SitDebugCamera({
  enabled,
  focusCanvas = { x: 400, y: 310 },
  orbitRef,
}: {
  enabled: boolean;
  focusCanvas?: { x: number; y: number };
  orbitRef?: { current: { enabled: boolean } | null };
}) {
  const { camera } = useThree();

  const apply = () => {
    const mode = enabled ? "side" : readSitDebugMode();
    if (orbitRef?.current) {
      if (mode) orbitRef.current.enabled = false;
    }
    if (!mode) return;

    const focus = resolveFocus(focusCanvas);
    const [fx, , fz] = toWorld(focus.x, focus.y);
    camera.near = 0.05;
    camera.far = 80;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = mode === "side" ? 36 : mode === "front" ? 34 : 40;
      camera.updateProjectionMatrix();
    }
    // North-wall signage (canvas y near 0): look north from inside the room.
    if (focus.y < 80) {
      if (mode === "side") {
        camera.position.set(fx + 0.2, 1.25, fz + 4.2);
        camera.lookAt(fx, 1.15, fz);
      } else if (mode === "front") {
        camera.position.set(fx, 1.2, fz + 3.8);
        camera.lookAt(fx, 1.05, fz);
      } else {
        camera.position.set(fx - 1.6, 2.2, fz + 3.6);
        camera.lookAt(fx, 1.05, fz);
      }
      return;
    }
    if (mode === "side") {
      // East elevation — read seated hips vs cushion and desk clearance.
      camera.position.set(fx + 2.4, 0.9, fz + 0.05);
      camera.lookAt(fx, 0.4, fz);
      return;
    }
    if (mode === "front") {
      // Look at the agent from the desk / keyboard side (along facing).
      const facing =
        typeof window !== "undefined" &&
        typeof window.__hermesSitDebugFacing === "number"
          ? window.__hermesSitDebugFacing
          : 0;
      const dist = 2.35;
      camera.position.set(
        fx + Math.sin(facing) * dist,
        0.78,
        fz + Math.cos(facing) * dist,
      );
      camera.lookAt(fx, 0.38, fz);
      return;
    }
    // Close isometric matching the office overview angle.
    camera.position.set(fx - 2.2, 2.8, fz + 2.2);
    camera.lookAt(fx, 0.28, fz);
  };

  useEffect(() => {
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply closes over camera + focus
  }, [camera, enabled, focusCanvas.x, focusCanvas.y]);

  useFrame(() => {
    apply();
  });

  return null;
}

export const isSitDebugEnabled = (): boolean => readSitDebugMode() !== null;

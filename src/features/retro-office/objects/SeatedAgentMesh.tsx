"use client";

/**
 * Dedicated iso-optimized seated body for original Hermes agents.
 *
 * Local units are scaled by the parent AgentModel (AGENT_SCALE). Geometry is
 * authored against workstationSeats clearance:
 *   - pelvis BOTTOM rests on the cushion (see ISO_SEATED_ROOT_Y)
 *   - thighs short along +Z, knees drop under the desktop apron
 *   - torso upright with a slight −Z bias toward the backrest
 *   - arms bent toward the keyboard
 *
 * Walking / standing meshes stay in AgentModel and crossfade against this group.
 */

import { memo } from "react";

export type SeatedAgentMeshColors = {
  skin: string;
  topColor: string;
  sleeveColor: string;
  trouserColor: string;
  shoeColor: string;
  bottomStyle: "shorts" | "pants" | "cuffed" | string;
};

/** Pelvis center height in local units (× AGENT_SCALE → world). */
export const SEATED_PELVIS_LOCAL_Y = 0.06;
/** Half-height of the pelvis box — bottom = center − half. */
export const SEATED_PELVIS_HALF_H = 0.025;

/**
 * World root Y so the pelvis BOTTOM sits on the chair cushion.
 * cushionWorldY − (pelvisCenterY − pelvisHalfH) × agentScale
 */
export const seatedRootWorldY = (
  cushionWorldY: number,
  agentScale: number,
): number =>
  cushionWorldY -
  (SEATED_PELVIS_LOCAL_Y - SEATED_PELVIS_HALF_H) * agentScale;

type SeatedAgentMeshProps = SeatedAgentMeshColors & {
  castShadow?: boolean;
};

export const SeatedAgentMesh = memo(function SeatedAgentMesh({
  skin,
  topColor,
  sleeveColor,
  trouserColor,
  shoeColor,
  bottomStyle,
  castShadow = false,
}: SeatedAgentMeshProps) {
  const shinColor = bottomStyle === "shorts" ? skin : trouserColor;

  return (
    <group>
      {/* Pelvis — sits on the cushion; slight −Z toward the backrest. */}
      <mesh
        position={[0, SEATED_PELVIS_LOCAL_Y, -0.01]}
        castShadow={castShadow}
      >
        <boxGeometry args={[0.135, SEATED_PELVIS_HALF_H * 2, 0.09]} />
        <meshStandardMaterial color={trouserColor} roughness={0.78} />
      </mesh>

      {/*
        Flexed legs for iso:
        - short thigh on the cushion (+Z, clear of the pan)
        - knee at the cushion front edge
        - shin drops down+forward under the desktop apron
      */}
      {([-0.038, 0.038] as const).map((hipX) => (
        <group key={`thigh-${hipX}`} position={[hipX, 0.085, 0]}>
          {/* Thigh pad on the cushion — stays above the seat surface. */}
          <mesh position={[0, 0.012, 0.03]} castShadow={castShadow}>
            <boxGeometry args={[0.044, 0.032, 0.07]} />
            <meshStandardMaterial color={trouserColor} roughness={0.78} />
          </mesh>
          {/* Knee hinge at cushion front. */}
          <mesh position={[0, 0.0, 0.068]} castShadow={castShadow}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color={shinColor} roughness={0.65} />
          </mesh>
          {/* Shin hanging under the desk (down + slight +Z). */}
          <mesh
            position={[0, -0.09, 0.09]}
            rotation={[0.25, 0, 0]}
            castShadow={castShadow}
          >
            <boxGeometry args={[0.036, 0.11, 0.036]} />
            <meshStandardMaterial color={shinColor} roughness={0.65} />
          </mesh>
          {/* Shoe under the desktop apron (world y ≈ 0.05 with root 0.2). */}
          <mesh position={[0, -0.175, 0.105]} castShadow={castShadow}>
            <boxGeometry args={[0.042, 0.024, 0.055]} />
            <meshStandardMaterial color={shoeColor} roughness={0.75} />
          </mesh>
        </group>
      ))}

      {/* Torso — upright, −Z so chest clears the desk / hugs the backrest. */}
      <mesh position={[0, 0.165, -0.025]} castShadow={castShadow}>
        <boxGeometry args={[0.145, 0.15, 0.08]} />
        <meshStandardMaterial color={topColor} roughness={0.75} />
      </mesh>

      {/* Typing arms — bent forward toward the keyboard. */}
      {([-1, 1] as const).map((side) => (
        <group
          key={`arm-${side}`}
          position={[0.095 * side, 0.205, -0.02]}
          rotation={[-1.0, 0.08 * side, 0.25 * side]}
        >
          <mesh position={[0, -0.045, 0]} castShadow={castShadow}>
            <boxGeometry args={[0.042, 0.09, 0.042]} />
            <meshStandardMaterial color={sleeveColor} roughness={0.75} />
          </mesh>
          <mesh
            position={[0, -0.1, 0.015]}
            rotation={[-0.5, 0, 0]}
            castShadow={castShadow}
          >
            <boxGeometry args={[0.038, 0.08, 0.038]} />
            <meshStandardMaterial color={sleeveColor} roughness={0.75} />
          </mesh>
          <mesh position={[0, -0.142, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.034, 0.034, 0.034]} />
            <meshStandardMaterial color={skin} roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Neck stub — standing head group lerps onto this height. */}
      <mesh position={[0, 0.255, -0.02]}>
        <boxGeometry args={[0.05, 0.032, 0.05]} />
        <meshStandardMaterial color={skin} roughness={0.55} />
      </mesh>
    </group>
  );
});

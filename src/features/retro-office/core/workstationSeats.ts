import { SCALE } from "@/features/retro-office/core/constants";
import {
  getItemRotationRadians,
  ITEM_FOOTPRINT,
  toWorld,
} from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";

/**
 * Single workstation seat reference derived from the real chair + desk pair.
 *
 * Geometric evidence (chairDesk.glb @ scale 1.0 + FURNITURE_MODEL_OFFSET
 * [0.02, 0, 0.08], sampled 2026-10-29):
 *   - cushion-band centroid in unpivot space ≈ (0.187, 0.24, −0.041)
 *   - footprint center in unpivot space = (0.216, 0, 0.216)
 *   - local offset from footprint center → (−0.029, 0, −0.257)
 *
 * Sitting on the footprint center alone leaves the agent ~0.26wu toward the
 * desk relative to the visible cushion (side/iso QA: agent floating in front
 * of the chair). Rotate that measured local offset by the chair facing.
 */

export type WorkstationSeat = {
  /** Desk cubicle id when authored (`desk_0` …). */
  deskId: string;
  /** Canvas sit point — chair seat center. */
  x: number;
  y: number;
  /** Radians — faces the desk / monitor from the chair. */
  facing: number;
  /** Legacy desk anchor used for index matching (`item.x + 40`, `item.y - 5`). */
  anchorX: number;
  anchorY: number;
  chairCenterX: number;
  chairCenterY: number;
  deskCenterX: number;
  deskCenterY: number;
  /** Approach point in the aisle (behind the chair). */
  approachX: number;
  approachY: number;
  /** World-space hip / root Y when fully seated (chair cushion). */
  hipWorldY: number;
  /** World clearance from seat center to desk north/near edge along facing. */
  deskClearanceWorld: number;
};

/** Match chairs to desks within this canvas radius. */
export const DESK_CHAIR_MATCH_RADIUS = 90;

/**
 * Bias (canvas units) along chair→away-from-desk.
 * Positive values push into the backrest (spine clipping). Keep near 0 so hips
 * rest on the cushion; desk clearance comes from aisle-clear chair placement.
 */
export const SEAT_AISLE_BIAS = 0;

/** Walk-up point behind the chair (canvas units along aisle). */
export const SEAT_APPROACH_DISTANCE = 36;

/** Arrive / remain seated within this canvas distance of the seat. */
export const DESK_SIT_ARRIVE_RADIUS = 18;

/** Leave the seat only after moving this far (hysteresis vs arrive). */
export const DESK_SIT_LEAVE_RADIUS = 36;

/**
 * Measured cushion-band centroid relative to the 24×24 footprint center, in
 * chair unpivot / model space (before facing rotation). See file header.
 */
export const CHAIR_CUSHION_LOCAL_OFFSET = { x: -0.029, z: -0.257 } as const;

/**
 * chairDesk.glb cushion-band average Y ≈ 0.24 world (sampled seat verts).
 * SeatedAgentMesh pelvis is a box centered at local y=0.06 with half-height
 * 0.025 — contact the cushion with the pelvis BOTTOM, not the center, so the
 * seat pad does not sink through the cushion:
 *   rootY = 0.24 − (0.06 − 0.025) × 1.75 = 0.179
 * A +0.02 clearance keeps the pelvis box from intersecting the cushion mesh.
 */
export const CHAIR_CUSHION_WORLD_Y = 0.24;
export const ISO_SEATED_HIP_LOCAL_Y = 0.06;
/** @see seatedRootWorldY in SeatedAgentMesh — keep in sync. */
export const ISO_SEATED_ROOT_Y = 0.2;

/** Rotate the measured cushion offset into canvas units for a chair facing. */
export const cushionCanvasOffsetForFacing = (
  rotYRadians: number,
): { x: number; y: number } => {
  const { x: lx, z: lz } = CHAIR_CUSHION_LOCAL_OFFSET;
  const cos = Math.cos(rotYRadians);
  const sin = Math.sin(rotYRadians);
  // Three.js Y-rotation: x' = x cos + z sin, z' = −x sin + z cos
  const worldDx = lx * cos + lz * sin;
  const worldDz = -lx * sin + lz * cos;
  return { x: worldDx / SCALE, y: worldDz / SCALE };
};

/** @deprecated Use SEAT_AISLE_BIAS — kept for test/import compatibility. */
export const DESK_SEAT_PULL_BACK = SEAT_AISLE_BIAS;

const unit = (x: number, y: number) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d, d };
};

/**
 * Build the eight (or N) workstation seats from furniture. Prefer the nearest
 * authored chair; fall back to the historical desk offset only when unmatched.
 */
export const getWorkstationSeats = (
  items: FurnitureItem[],
): WorkstationSeat[] => {
  const chairs = items.filter((item) => item.type === "chair");
  const [deskW, deskH] = ITEM_FOOTPRINT.desk_cubicle;
  const [chairW, chairH] = ITEM_FOOTPRINT.chair;

  return items
    .filter((item) => item.type === "desk_cubicle")
    .map((item, index) => {
      const anchorX = item.x + 40;
      const anchorY = item.y - 5;
      const deskCenterX = item.x + deskW / 2;
      const deskCenterY = item.y + deskH / 2;
      const deskId =
        typeof item.id === "string" && item.id.length > 0
          ? item.id
          : `desk_${index}`;

      let bestChair: FurnitureItem | null = null;
      let bestChairCenter: { x: number; y: number } | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const chair of chairs) {
        const seatX = chair.x + chairW / 2;
        const seatY = chair.y + chairH / 2;
        const distance = Math.hypot(seatX - deskCenterX, seatY - deskCenterY);
        if (distance < bestDistance && distance <= DESK_CHAIR_MATCH_RADIUS) {
          bestDistance = distance;
          bestChair = chair;
          bestChairCenter = { x: seatX, y: seatY };
        }
      }

      if (!bestChair || !bestChairCenter) {
        const facing = Math.atan2(
          deskCenterX - anchorX,
          deskCenterY - anchorY,
        );
        const away = unit(anchorX - deskCenterX, anchorY - deskCenterY);
        return {
          deskId,
          x: anchorX + away.x * SEAT_AISLE_BIAS,
          y: anchorY + away.y * SEAT_AISLE_BIAS,
          facing,
          anchorX,
          anchorY,
          chairCenterX: anchorX,
          chairCenterY: anchorY,
          deskCenterX,
          deskCenterY,
          approachX: anchorX + away.x * SEAT_APPROACH_DISTANCE,
          approachY: anchorY + away.y * SEAT_APPROACH_DISTANCE,
          hipWorldY: ISO_SEATED_ROOT_Y,
          deskClearanceWorld: Math.max(0, (away.d - SEAT_AISLE_BIAS) * SCALE),
        };
      }

      const facing = Math.atan2(
        deskCenterX - bestChairCenter.x,
        deskCenterY - bestChairCenter.y,
      );
      const away = unit(
        bestChairCenter.x - deskCenterX,
        bestChairCenter.y - deskCenterY,
      );
      // Prefer the authored chair facing (after orientDeskChairsTowardDesks);
      // fall back to the geometric desk-facing so the cushion offset still
      // tracks the visible mesh when furniture has not been reoriented yet.
      const chairRotY = getItemRotationRadians(bestChair);
      const cushion = cushionCanvasOffsetForFacing(
        Number.isFinite(chairRotY) ? chairRotY : facing,
      );
      const x =
        bestChairCenter.x + cushion.x + away.x * SEAT_AISLE_BIAS;
      const y =
        bestChairCenter.y + cushion.y + away.y * SEAT_AISLE_BIAS;
      const [sx, , sz] = toWorld(x, y);
      const [dx, , dz] = toWorld(deskCenterX, deskCenterY);
      const deskClearanceWorld = Math.hypot(dx - sx, dz - sz);

      return {
        deskId,
        x,
        y,
        facing,
        anchorX,
        anchorY,
        chairCenterX: bestChairCenter.x,
        chairCenterY: bestChairCenter.y,
        deskCenterX,
        deskCenterY,
        approachX: bestChairCenter.x + away.x * SEAT_APPROACH_DISTANCE,
        approachY: bestChairCenter.y + away.y * SEAT_APPROACH_DISTANCE,
        hipWorldY: ISO_SEATED_ROOT_Y,
        deskClearanceWorld,
      };
    });
};

/** Back-compat alias used by RetroOffice3D / GameLoop. */
export const getDeskLocations = getWorkstationSeats;

export type DeskSeatLocation = WorkstationSeat;

/**
 * Reorient desk-paired chairs to face their desk. Legacy layouts used
 * facing:180 which aimed the backrest at the monitor and put agents through
 * the chair spine.
 */
export const orientDeskChairsTowardDesks = (
  items: FurnitureItem[],
): FurnitureItem[] => {
  const seats = getWorkstationSeats(items);
  const [chairW, chairH] = ITEM_FOOTPRINT.chair;
  return items.map((item) => {
    if (item.type !== "chair") return item;
    const cx = item.x + chairW / 2;
    const cy = item.y + chairH / 2;
    let best: (typeof seats)[number] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const seat of seats) {
      const distance = Math.hypot(cx - seat.chairCenterX, cy - seat.chairCenterY);
      if (distance < bestDistance && distance <= 8) {
        bestDistance = distance;
        best = seat;
      }
    }
    if (!best) return item;
    const facingDeg = Math.round((best.facing * 180) / Math.PI);
    const normalized = ((facingDeg % 360) + 360) % 360;
    if (item.facing === normalized) return item;
    return { ...item, facing: normalized };
  });
};

export const resolveDeskIndexForItem = (
  item: FurnitureItem,
  deskLocations: Array<{
    x: number;
    y: number;
    anchorX?: number;
    anchorY?: number;
  }>,
): number => {
  if (deskLocations.length === 0) return -1;
  if (item.type === "desk_cubicle") {
    const anchorX = item.x + 40;
    const anchorY = item.y - 5;
    const byAnchor = deskLocations.findIndex(
      (desk) =>
        (desk.anchorX ?? desk.x) === anchorX &&
        (desk.anchorY ?? desk.y) === anchorY,
    );
    if (byAnchor >= 0) return byAnchor;
  }

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const [itemW, itemH] = ITEM_FOOTPRINT[item.type] ?? [0, 0];
  const itemCenterX = item.x + itemW / 2;
  const itemCenterY = item.y + itemH / 2;
  for (let index = 0; index < deskLocations.length; index += 1) {
    const desk = deskLocations[index];
    if (!desk) continue;
    const deskX = desk.anchorX ?? desk.x;
    const deskY = desk.anchorY ?? desk.y;
    const distance = Math.hypot(itemCenterX - deskX, itemCenterY - deskY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestDistance <= 100 ? bestIndex : -1;
};

import { SCALE } from "@/features/retro-office/core/constants";
import {
  getItemRotationRadians,
  ITEM_FOOTPRINT,
  toWorld,
} from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";
import {
  DESK_CHAIR_MATCH_RADIUS,
  getWorkstationSeats,
} from "@/features/retro-office/core/workstationSeats";

/**
 * Workstation surface anchors for the eight `desk_cubicle` posts.
 *
 * Root cause of floating / aisle-side peripherals:
 * `desk.glb` was shifted with `FURNITURE_MODEL_OFFSET [0.35, 0, 0.38]`
 * (was 0.55) so the visible slab sits inside the 100×55 footprint, but
 * `computer` / `keyboard` / `mouse` still used absolute canvas coords authored
 * against the pre-offset desk (near the chair aisle). Keyboard/mouse also
 * ignored item facing.
 *
 * Layout axes are derived from the chair→surface vector (not raw seat facing
 * alone) so props stay on the desk depth axis instead of skewing diagonally
 * across the slab when the chair is slightly offset.
 */

/** Measured desk.glb @ scale 1.5 + model offset — top slab Y. */
export const DESK_CUBICLE_SURFACE_Y = 0.577;

/**
 * Visual surface centroid relative to the 100×55 footprint center, in desk
 * unpivot space at facing 0 (world XZ).
 * Re-derived 2026-10-29 after FURNITURE_MODEL_OFFSET.z 0.55→0.38
 * (Δz_world = 1.5 × −0.17 = −0.255wu toward aisle / −Z).
 */
export const DESK_CUBICLE_SURFACE_CENTER_LOCAL = {
  x: 0.161,
  z: -0.201,
} as const;

/**
 * computerScreen.glb is authored with its origin on the left edge
 * (bbox x 0…0.393). Center it under the footprint pivot.
 */
export const COMPUTER_MODEL_CENTER_OFFSET = {
  x: -0.216,
  y: 0,
  z: 0.057,
} as const;

/**
 * World-unit offsets along chair↔desk (towardChair) and agent-right.
 * Positive towardChair = closer to the seated agent (near lip).
 * Negative = toward the back of the slab (away from agent).
 *
 * Keep |towardChair| modest: desk.glb slab after FURNITURE_MODEL_OFFSET is
 * shallower toward the aisle than the 55px footprint; 0.34wu spilled past the
 * visual lip (keyboard/mouse hanging in air toward the chair).
 */
export const MONITOR_ANCHOR_OFFSET = {
  towardChair: -0.06,
  right: 0,
} as const;
export const KEYBOARD_ANCHOR_OFFSET = {
  towardChair: 0.28,
  right: 0,
} as const;
export const MOUSE_ANCHOR_OFFSET = {
  towardChair: 0.28,
  right: 0.12,
} as const;

/** Keep the prop cluster on the slab when the chair is laterally offset. */
const MAX_LATERAL_WU = 0.12;

/**
 * Pull each desk footprint toward its matched seat so the visual slab sits at
 * a natural typing distance — chairs / seated agents stay fixed.
 *
 * Measured seat→surface was ~1.39wu with aisle-clear chairs; a ~0.55wu near-lip
 * gap still reads as "using the desk" without driving legs into the slab.
 * Target is seat→deskCenter (idempotent from the chair, not a repeated delta).
 */
export const DESK_REACH_TARGET_SEAT_TO_CENTER_WU = 0.6;

/** Hard floor — below this, legs clip the desk volume in side QA. */
export const DESK_REACH_MIN_SEAT_TO_CENTER_WU = 0.55;

/**
 * Scope for the reach nudge. Start with `desk_0` only; flip to `all` after
 * desk_0 iso+side QA passes without leg clipping.
 */
export const DESK_REACH_NUDGE_SCOPE: "desk_0" | "all" = "all";

const deskReachInScope = (deskId: string): boolean =>
  DESK_REACH_NUDGE_SCOPE === "all" || deskId === DESK_REACH_NUDGE_SCOPE;

export type WorkstationPropAnchor = {
  /** Canvas top-left for the furniture item footprint. */
  x: number;
  y: number;
  /** Degrees — screen / keys face the seated agent. */
  facing: number;
  /** World Y for the prop resting on the desk surface. */
  surfaceY: number;
};

export type WorkstationAnchors = {
  deskId: string;
  deskUid?: string;
  /** Visual desk surface center in canvas units. */
  surfaceX: number;
  surfaceYCanvas: number;
  surfaceWorldY: number;
  /** Radians — direction from chair toward desk surface. */
  facing: number;
  monitor: WorkstationPropAnchor;
  keyboard: WorkstationPropAnchor;
  mouse: WorkstationPropAnchor;
};

const rotateLocalToCanvas = (
  localX: number,
  localZ: number,
  rotY: number,
): { x: number; y: number } => {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const worldDx = localX * cos + localZ * sin;
  const worldDz = -localX * sin + localZ * cos;
  return { x: worldDx / SCALE, y: worldDz / SCALE };
};

const propTopLeft = (
  centerX: number,
  centerY: number,
  type: "computer" | "keyboard" | "mouse",
): { x: number; y: number } => {
  const [w, h] = ITEM_FOOTPRINT[type];
  return { x: centerX - w / 2, y: centerY - h / 2 };
};

const facingDegrees = (radians: number): number => {
  const deg = Math.round((radians * 180) / Math.PI);
  return ((deg % 360) + 360) % 360;
};

const unit2 = (x: number, y: number) => {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d, d };
};

/**
 * Build per-desk anchors from furniture. Chair→surface drives depth; agent
 * right is perpendicular so mouse stays on the correct side.
 */
export const getWorkstationAnchors = (
  items: FurnitureItem[],
): WorkstationAnchors[] => {
  const seats = getWorkstationSeats(items);
  const [deskW, deskH] = ITEM_FOOTPRINT.desk_cubicle;

  return items
    .filter((item) => item.type === "desk_cubicle")
    .map((item, index) => {
      const deskId =
        typeof item.id === "string" && item.id.length > 0
          ? item.id
          : `desk_${index}`;
      const footprintCenterX = item.x + deskW / 2;
      const footprintCenterY = item.y + deskH / 2;

      const seat =
        seats.find((entry) => entry.deskId === deskId) ??
        seats.find(
          (entry) =>
            Math.hypot(
              entry.deskCenterX - footprintCenterX,
              entry.deskCenterY - footprintCenterY,
            ) <= DESK_CHAIR_MATCH_RADIUS,
        ) ??
        null;

      const deskRotY = getItemRotationRadians(item);
      const surfaceLocal = rotateLocalToCanvas(
        DESK_CUBICLE_SURFACE_CENTER_LOCAL.x,
        DESK_CUBICLE_SURFACE_CENTER_LOCAL.z,
        deskRotY,
      );
      const surfaceX = footprintCenterX + surfaceLocal.x;
      const surfaceYCanvas = footprintCenterY + surfaceLocal.y;

      // Depth axis: from surface toward the chair (seat canvas position).
      const chairX = seat?.x ?? surfaceX;
      const chairY = seat?.y ?? surfaceYCanvas - 40;
      const towardChair = unit2(chairX - surfaceX, chairY - surfaceYCanvas);
      // Agent looks from chair toward desk = opposite of towardChair.
      const facing = Math.atan2(-towardChair.x, -towardChair.y);
      // Agent's right when facing the desk.
      const right = { x: -towardChair.y, y: towardChair.x };

      // Shift the whole prop cluster laterally so it lines up with the chair,
      // not just the geometric surface centroid (chairs are often offset in X).
      const chairLateralCanvas =
        (chairX - surfaceX) * right.x + (chairY - surfaceYCanvas) * right.y;
      const chairLateralWu = Math.max(
        -MAX_LATERAL_WU,
        Math.min(MAX_LATERAL_WU, chairLateralCanvas * SCALE),
      );

      const place = (towardChairWu: number, rightWu: number) => ({
        x:
          surfaceX +
          (towardChair.x * towardChairWu +
            right.x * (rightWu + chairLateralWu)) /
            SCALE,
        y:
          surfaceYCanvas +
          (towardChair.y * towardChairWu +
            right.y * (rightWu + chairLateralWu)) /
            SCALE,
      });

      const monitorCenter = place(
        MONITOR_ANCHOR_OFFSET.towardChair,
        MONITOR_ANCHOR_OFFSET.right,
      );
      const keyboardCenter = place(
        KEYBOARD_ANCHOR_OFFSET.towardChair,
        KEYBOARD_ANCHOR_OFFSET.right,
      );
      const mouseCenter = place(
        MOUSE_ANCHOR_OFFSET.towardChair,
        MOUSE_ANCHOR_OFFSET.right,
      );

      const facingDeg = facingDegrees(facing);
      // Agent facing looks toward the desk. computerScreen.glb's visible screen
      // follows the item forward axis, so the monitor must face the opposite
      // heading (toward the seated agent), not the wall behind the desk.
      const monitorFacingDeg = facingDegrees(facing + Math.PI);

      return {
        deskId,
        deskUid: item._uid,
        surfaceX,
        surfaceYCanvas,
        surfaceWorldY: DESK_CUBICLE_SURFACE_Y,
        facing,
        monitor: {
          ...propTopLeft(monitorCenter.x, monitorCenter.y, "computer"),
          facing: monitorFacingDeg,
          surfaceY: DESK_CUBICLE_SURFACE_Y,
        },
        keyboard: {
          ...propTopLeft(keyboardCenter.x, keyboardCenter.y, "keyboard"),
          facing: facingDeg,
          surfaceY: DESK_CUBICLE_SURFACE_Y,
        },
        mouse: {
          ...propTopLeft(mouseCenter.x, mouseCenter.y, "mouse"),
          facing: facingDeg,
          surfaceY: DESK_CUBICLE_SURFACE_Y,
        },
      };
    });
};

const nearestAnchor = (
  anchors: WorkstationAnchors[],
  x: number,
  y: number,
  w: number,
  h: number,
): WorkstationAnchors | null => {
  const cx = x + w / 2;
  const cy = y + h / 2;
  let best: WorkstationAnchors | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const distance = Math.hypot(cx - anchor.surfaceX, cy - anchor.surfaceYCanvas);
    if (distance < bestDistance && distance <= DESK_CHAIR_MATCH_RADIUS + 40) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return best;
};

/**
 * Move in-scope `desk_cubicle` footprints toward their matched seats so the
 * visual slab closes the reach gap. Chairs are never moved. Idempotent: the
 * desk center is placed at a fixed seat→center distance along the seat facing.
 */
export const nudgeDesksTowardSeats = (
  items: FurnitureItem[],
): FurnitureItem[] => {
  const seats = getWorkstationSeats(items);
  if (seats.length === 0) return items;
  const [deskW, deskH] = ITEM_FOOTPRINT.desk_cubicle;
  const targetWu = Math.max(
    DESK_REACH_MIN_SEAT_TO_CENTER_WU,
    DESK_REACH_TARGET_SEAT_TO_CENTER_WU,
  );
  const targetCanvas = targetWu / SCALE;

  return items.map((item, index) => {
    if (item.type !== "desk_cubicle") return item;
    const deskId =
      typeof item.id === "string" && item.id.length > 0
        ? item.id
        : `desk_${index}`;
    if (!deskReachInScope(deskId)) return item;

    const footprintCenterX = item.x + deskW / 2;
    const footprintCenterY = item.y + deskH / 2;
    const seat =
      seats.find((entry) => entry.deskId === deskId) ??
      seats.find(
        (entry) =>
          Math.hypot(
            entry.deskCenterX - footprintCenterX,
            entry.deskCenterY - footprintCenterY,
          ) <= DESK_CHAIR_MATCH_RADIUS,
      ) ??
      null;
    if (!seat) return item;

    // Place desk center along the seat→desk ray at the target distance.
    const away = unit2(
      footprintCenterX - seat.x,
      footprintCenterY - seat.y,
    );
    const nextCenterX = seat.x + away.x * targetCanvas;
    const nextCenterY = seat.y + away.y * targetCanvas;
    const nextX = nextCenterX - deskW / 2;
    const nextY = nextCenterY - deskH / 2;
    if (
      Math.abs(nextX - item.x) < 0.05 &&
      Math.abs(nextY - item.y) < 0.05
    ) {
      return item;
    }
    return { ...item, x: nextX, y: nextY };
  });
};

/**
 * Drop aisle trash cans that sit between chair and desk (read as black litter
 * under seated agents). Keep lobby / kitchen trash away from workstations.
 */
export const removeMisplacedWorkstationFloorProps = (
  items: FurnitureItem[],
): FurnitureItem[] => {
  const seats = getWorkstationSeats(items);
  if (seats.length === 0) return items;
  const [trashW, trashH] = ITEM_FOOTPRINT.trash;

  return items.filter((item) => {
    if (item.type !== "trash") return true;
    const cx = item.x + trashW / 2;
    const cy = item.y + trashH / 2;
    for (const seat of seats) {
      // Between seat and desk, or beside the chair pad — the black cylinders
      // that showed up under agents' feet in reach-gap QA.
      const nearSeat = Math.hypot(cx - seat.x, cy - seat.y) < 48;
      const nearDesk =
        Math.hypot(cx - seat.deskCenterX, cy - seat.deskCenterY) < 70;
      if (nearSeat || (nearDesk && Math.hypot(cx - seat.x, cy - seat.y) < 90)) {
        return false;
      }
    }
    return true;
  });
};

/**
 * Snap computer / keyboard / mouse onto their nearest desk surface anchors.
 * Preserves unrelated furniture. Safe to run on every layout materialize.
 */
export const anchorWorkstationProps = (
  items: FurnitureItem[],
): FurnitureItem[] => {
  const cleaned = removeMisplacedWorkstationFloorProps(items);
  const nudged = nudgeDesksTowardSeats(cleaned);
  const anchors = getWorkstationAnchors(nudged);
  if (anchors.length === 0) return nudged;

  return nudged.map((item) => {
    if (item.type === "computer") {
      const [w, h] = ITEM_FOOTPRINT.computer;
      const anchor = nearestAnchor(anchors, item.x, item.y, w, h);
      if (!anchor) return item;
      const next = anchor.monitor;
      if (
        item.x === next.x &&
        item.y === next.y &&
        item.facing === next.facing
      ) {
        return item;
      }
      return { ...item, x: next.x, y: next.y, facing: next.facing };
    }
    if (item.type === "keyboard") {
      const [w, h] = ITEM_FOOTPRINT.keyboard;
      const anchor = nearestAnchor(anchors, item.x, item.y, w, h);
      if (!anchor) return item;
      const next = anchor.keyboard;
      if (
        item.x === next.x &&
        item.y === next.y &&
        item.facing === next.facing
      ) {
        return item;
      }
      return { ...item, x: next.x, y: next.y, facing: next.facing };
    }
    if (item.type === "mouse") {
      const [w, h] = ITEM_FOOTPRINT.mouse;
      const anchor = nearestAnchor(anchors, item.x, item.y, w, h);
      if (!anchor) return item;
      const next = anchor.mouse;
      if (
        item.x === next.x &&
        item.y === next.y &&
        item.facing === next.facing
      ) {
        return item;
      }
      return { ...item, x: next.x, y: next.y, facing: next.facing };
    }
    return item;
  });
};

/** Debug helper — world-space surface sample for a desk item. */
export const deskSurfaceWorldSample = (
  item: FurnitureItem,
): { x: number; y: number; z: number } | null => {
  if (item.type !== "desk_cubicle") return null;
  const [deskW, deskH] = ITEM_FOOTPRINT.desk_cubicle;
  const rotY = getItemRotationRadians(item);
  const local = rotateLocalToCanvas(
    DESK_CUBICLE_SURFACE_CENTER_LOCAL.x,
    DESK_CUBICLE_SURFACE_CENTER_LOCAL.z,
    rotY,
  );
  const [wx, , wz] = toWorld(
    item.x + deskW / 2 + local.x,
    item.y + deskH / 2 + local.y,
  );
  return { x: wx, y: DESK_CUBICLE_SURFACE_Y, z: wz };
};

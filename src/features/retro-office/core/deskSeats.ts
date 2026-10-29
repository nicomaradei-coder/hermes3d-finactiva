/**
 * Desk seat helpers — implementation lives in `workstationSeats.ts`
 * (chair-derived seat reference + iso-safe sit constants).
 */
export {
  CHAIR_CUSHION_LOCAL_OFFSET,
  CHAIR_CUSHION_WORLD_Y,
  cushionCanvasOffsetForFacing,
  DESK_CHAIR_MATCH_RADIUS,
  DESK_SEAT_PULL_BACK,
  DESK_SIT_ARRIVE_RADIUS,
  DESK_SIT_LEAVE_RADIUS,
  getDeskLocations,
  getWorkstationSeats,
  ISO_SEATED_ROOT_Y,
  orientDeskChairsTowardDesks,
  resolveDeskIndexForItem,
  SEAT_AISLE_BIAS,
  SEAT_APPROACH_DISTANCE,
  type DeskSeatLocation,
  type WorkstationSeat,
} from "@/features/retro-office/core/workstationSeats";

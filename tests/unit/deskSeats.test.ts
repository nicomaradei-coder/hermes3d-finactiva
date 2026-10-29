import { describe, expect, it } from "vitest";
import {
  SEAT_AISLE_BIAS,
  cushionCanvasOffsetForFacing,
  getWorkstationSeats,
  resolveDeskIndexForItem,
} from "@/features/retro-office/core/deskSeats";
import { getItemRotationRadians } from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const deskWithChair: FurnitureItem[] = [
  { type: "desk_cubicle", x: 100, y: 300, id: "desk_0", _uid: "d0" },
  { type: "chair", x: 120, y: 262, facing: 180, _uid: "c0" },
  { type: "desk_cubicle", x: 100, y: 500, id: "desk_4", _uid: "d4" },
];

describe("workstation seats (chair-derived)", () => {
  it(`keeps the sit point on the chair cushion (aisle bias ${SEAT_AISLE_BIAS})`, () => {
    const seats = getWorkstationSeats(deskWithChair);
    expect(seats).toHaveLength(2);

    const chairCenter = { x: 132, y: 274 };
    const deskCenter = { x: 150, y: 327.5 };
    const awayX = chairCenter.x - deskCenter.x;
    const awayY = chairCenter.y - deskCenter.y;
    const awayDist = Math.hypot(awayX, awayY) || 1;
    const chair = deskWithChair[1]!;
    const cushion = cushionCanvasOffsetForFacing(getItemRotationRadians(chair));
    const expectedX =
      chairCenter.x + cushion.x + (awayX / awayDist) * SEAT_AISLE_BIAS;
    const expectedY =
      chairCenter.y + cushion.y + (awayY / awayDist) * SEAT_AISLE_BIAS;

    expect(seats[0]?.x).toBeCloseTo(expectedX, 5);
    expect(seats[0]?.y).toBeCloseTo(expectedY, 5);
    expect(seats[0]?.chairCenterX).toBeCloseTo(chairCenter.x, 5);
    expect(seats[0]?.chairCenterY).toBeCloseTo(chairCenter.y, 5);
    expect(seats[0]?.anchorX).toBe(140);
    expect(seats[0]?.anchorY).toBe(295);
    // Faces the desk/monitor, not authored 180° (away from work surface).
    expect(seats[0]?.facing).toBeCloseTo(
      Math.atan2(deskCenter.x - chairCenter.x, deskCenter.y - chairCenter.y),
      5,
    );
    // Sit point stays on the measured cushion band (not the footprint center).
    expect(
      Math.hypot(
        (seats[0]?.x ?? 0) - (chairCenter.x + cushion.x),
        (seats[0]?.y ?? 0) - (chairCenter.y + cushion.y),
      ),
    ).toBeLessThanOrEqual(SEAT_AISLE_BIAS + 0.01);
    expect(SEAT_AISLE_BIAS).toBeLessThanOrEqual(4);
    // Chair pad must not overlap the desk north edge (y=300).
    expect((seats[0]?.chairCenterY ?? 0) + 12).toBeLessThan(300);

    // desk_4 has no chair — falls back to legacy anchor + aisle bias
    const fallbackAnchor = { x: 140, y: 495 };
    const fallbackDesk = { x: 150, y: 527.5 };
    const fAwayX = fallbackAnchor.x - fallbackDesk.x;
    const fAwayY = fallbackAnchor.y - fallbackDesk.y;
    const fDist = Math.hypot(fAwayX, fAwayY);
    expect(seats[1]?.x).toBeCloseTo(
      fallbackAnchor.x + (fAwayX / fDist) * SEAT_AISLE_BIAS,
      5,
    );
    expect(seats[1]?.y).toBeCloseTo(
      fallbackAnchor.y + (fAwayY / fDist) * SEAT_AISLE_BIAS,
      5,
    );
  });

  it("still resolves desk_cubicle index via seat anchors", () => {
    const seats = getWorkstationSeats(deskWithChair);
    expect(resolveDeskIndexForItem(deskWithChair[0]!, seats)).toBe(0);
    expect(resolveDeskIndexForItem(deskWithChair[2]!, seats)).toBe(1);
  });

  it("reorients desk chairs to face their desk", async () => {
    const { orientDeskChairsTowardDesks } = await import(
      "@/features/retro-office/core/deskSeats"
    );
    const oriented = orientDeskChairsTowardDesks(deskWithChair);
    const chair = oriented.find((item) => item._uid === "c0");
    expect(chair?.facing).toBeGreaterThan(0);
    expect(chair?.facing).toBeLessThan(90);
  });
});

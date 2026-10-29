/** WebGL reset key. Agent count is intentionally absent so a roster fill does not remount the canvas. */
export function buildOfficeCanvasResetKey(input: {
  remoteOfficeEnabled: boolean;
  gatewayStatus?: string | null;
  officeCenterSignal: number;
}): string {
  return [
    input.remoteOfficeEnabled ? "remote" : "local",
    input.gatewayStatus ?? "unknown",
    String(input.officeCenterSignal),
  ].join(":");
}

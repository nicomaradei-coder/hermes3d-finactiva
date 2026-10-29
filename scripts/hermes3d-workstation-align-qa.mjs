/**
 * Workstation alignment QA — iso + side for each of 8 desks.
 * Clears furniture v10 so v11 anchors apply. No PASS declaration.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.HERMES_URL || "http://127.0.0.1:3000";
const GATEWAY = process.env.HERMES_GATEWAY || "http://127.0.0.1:7770";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chair-ish focus (canvas) so side/iso frame agent + desk props together. */
const DESKS = [
  { id: "desk_0", x: 132, y: 274, surfaceX: 159, surfaceY: 330 },
  { id: "desk_1", x: 332, y: 274, surfaceX: 359, surfaceY: 330 },
  { id: "desk_2", x: 532, y: 274, surfaceX: 559, surfaceY: 330 },
  { id: "desk_3", x: 732, y: 274, surfaceX: 759, surfaceY: 330 },
  { id: "desk_4", x: 132, y: 474, surfaceX: 159, surfaceY: 530 },
  { id: "desk_5", x: 322, y: 474, surfaceX: 359, surfaceY: 530 },
  { id: "desk_6", x: 532, y: 474, surfaceX: 559, surfaceY: 530 },
  { id: "desk_7", x: 732, y: 474, surfaceX: 759, surfaceY: 530 },
];

async function connect(page) {
  await page.addInitScript(() => {
    localStorage.setItem("hermes3d:onboarding:completed", "true");
    localStorage.setItem("hermes3d.graphicsQuality", "eco");
    localStorage.setItem("hermes-office-render-mode-v1", "3d");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("hermes-office-furniture")) localStorage.removeItem(key);
    }
  });
  await page.goto(`${BASE}/office`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(1800);
  for (let i = 0; i < 8; i++) {
    const skip = page.getByRole("button", { name: /Skip/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ force: true });
      break;
    }
    const next = page.getByRole("button", { name: /^Next$/i });
    if (await next.isVisible().catch(() => false)) {
      await next.click({ force: true });
      await sleep(250);
      continue;
    }
    break;
  }
  await page.keyboard.press("Escape").catch(() => {});
  const mode3d = page.getByTestId("connect-render-mode-3d");
  if (await mode3d.isVisible().catch(() => false)) {
    await mode3d.click({ force: true });
  }
  await page
    .getByRole("button", { name: /Custom backend/i })
    .click({ force: true })
    .catch(() => {});
  const url = page.locator('input[placeholder*="gateway"]').first();
  if (await url.isVisible().catch(() => false)) await url.fill(GATEWAY);
  await page
    .getByRole("button", { name: /^Connect$/i })
    .click({ force: true })
    .catch(() => {});
}

async function waitAgents(page, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const n = await page.evaluate(
      () => window.__hermesRenderSnapshot?.agents?.length ?? 0,
    );
    if (n >= 8) return true;
    await sleep(1500);
  }
  return false;
}

async function focusMode(page, mode, x, y, facing = 0) {
  await page.evaluate(
    ({ mode, x, y, facing }) => {
      window.__hermesSitDebug = mode === "side";
      window.__hermesIsoDebug = mode === "iso";
      window.__hermesFrontDebug = mode === "front";
      window.__hermesSitDebugFocus = { x, y };
      window.__hermesSitDebugFacing = facing;
    },
    { mode, x, y, facing },
  );
  await sleep(1300);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await connect(page);
  if (!(await waitAgents(page))) {
    fs.writeFileSync(
      path.join(OUT, "hermes3d-workstation-align-qa.json"),
      JSON.stringify({ ok: false, error: "no_agents" }, null, 2),
    );
    await browser.close();
    process.exit(2);
  }

  // Wait for some sitters
  for (let i = 0; i < 40; i++) {
    const sitting = await page.evaluate(
      () => window.__hermesRenderSnapshot?.byState?.sitting ?? 0,
    );
    if (sitting >= 4) break;
    await sleep(2000);
  }

  await page.evaluate(() => {
    window.__hermesSitDebug = false;
    window.__hermesIsoDebug = false;
    window.__hermesFrontDebug = false;
  });
  await sleep(800);
  await page.screenshot({
    path: path.join(OUT, "hermes3d-workstation-align-full-office.png"),
  });

  const deskReports = [];
  for (const desk of DESKS) {
    const snap = await page.evaluate(() => window.__hermesRenderSnapshot);
    const sitter = (snap?.agents || []).find(
      (a) =>
        a.state === "sitting" &&
        Math.hypot(a.x - desk.x, a.y - desk.y) < 55,
    );
    // Midpoint between seat and desk surface — frames agent + props.
    const seat = sitter
      ? { x: sitter.x, y: sitter.y }
      : { x: desk.x, y: desk.y };
    const focus = {
      x: (seat.x + desk.surfaceX) / 2,
      y: (seat.y + desk.surfaceY) / 2,
    };
    const facing = Math.atan2(desk.surfaceX - seat.x, desk.surfaceY - seat.y);

    await focusMode(page, "iso", focus.x, focus.y, facing);
    await page.screenshot({
      path: path.join(OUT, `hermes3d-workstation-align-${desk.id}-iso.png`),
    });
    await focusMode(page, "side", focus.x, focus.y, facing);
    await page.screenshot({
      path: path.join(OUT, `hermes3d-workstation-align-${desk.id}-side.png`),
    });
    deskReports.push({
      desk: desk.id,
      focus,
      seat,
      sitter: sitter ? sitter.id : null,
    });
  }

  await page.evaluate(() => {
    window.__hermesSitDebug = false;
    window.__hermesIsoDebug = false;
    window.__hermesFrontDebug = false;
  });

  const snap = await page.evaluate(() => window.__hermesRenderSnapshot);
  const report = {
    at: new Date().toISOString(),
    header: (await page.locator("text=FINACTIVA HQ").count()) > 0,
    customOk: (await page.locator("text=CONNECTED").count()) > 0,
    byState: snap?.byState ?? null,
    deskReports,
    errors: [...new Set(errors)].slice(0, 20),
    note: "Visual PASS requires reviewing per-desk iso+side PNGs for floating/inverted props.",
  };
  fs.writeFileSync(
    path.join(OUT, "hermes3d-workstation-align-qa.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

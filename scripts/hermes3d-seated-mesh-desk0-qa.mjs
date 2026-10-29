/**
 * FINAL SEATED MESH FIX — validate ONE workstation (desk_0) before rolling out.
 * Captures side / front / iso. Does not declare PASS.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.HERMES_URL || "http://127.0.0.1:3000";
const GATEWAY = process.env.HERMES_GATEWAY || "http://127.0.0.1:7770";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESK0 = { id: "desk_0", x: 132, y: 274 };

async function seedStorage(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("hermes3d:onboarding:completed", "true");
      localStorage.setItem("hermes3d.graphicsQuality", "eco");
      localStorage.setItem("hermes-office-render-mode-v1", "3d");
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("hermes-office-furniture")) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }
  });
}

async function connectOffice(page) {
  await page.goto(`${BASE}/office`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await sleep(1500);
  for (let i = 0; i < 10; i++) {
    const skip = page.getByRole("button", { name: /Skip/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ force: true });
      await sleep(400);
      break;
    }
    const next = page.getByRole("button", { name: /^Next$/i });
    if (await next.isVisible().catch(() => false)) {
      await next.click({ force: true });
      await sleep(300);
      continue;
    }
    break;
  }
  await page.keyboard.press("Escape").catch(() => {});

  const mode3d = page.getByTestId("connect-render-mode-3d");
  if (await mode3d.isVisible().catch(() => false)) {
    await mode3d.click({ force: true });
    await page.getByRole("button", { name: /Custom backend/i }).click({
      force: true,
    });
    const urlInput = page.locator('input[placeholder*="gateway"]').first();
    if (await urlInput.isVisible().catch(() => false)) {
      await urlInput.fill(GATEWAY);
    }
    await page
      .getByRole("button", { name: /^Connect$/i })
      .click({ force: true });
  }
}

async function waitForCanvas(page, timeout = 180000) {
  const start = Date.now();
  let last = { canvas: 0, agents: 0 };
  while (Date.now() - start < timeout) {
    last = await page.evaluate(() => {
      const canvas = document.querySelectorAll("canvas").length;
      const agents = window.__hermesRenderSnapshot?.agents?.length ?? 0;
      return { canvas, agents };
    });
    if (last.canvas > 0 && last.agents >= 8) {
      await sleep(2500);
      return { ok: true, ...last };
    }
    await sleep(last.canvas > 0 ? 1200 : 2000);
  }
  return { ok: false, ...last };
}

async function waitDesk0Sitting(page, maxMs = 180000) {
  const started = Date.now();
  let best = null;
  while (Date.now() - started < maxMs) {
    const snap = await page.evaluate(() => window.__hermesRenderSnapshot);
    const sitter = (snap?.agents || []).find(
      (a) =>
        a.state === "sitting" &&
        Math.hypot(a.x - DESK0.x, a.y - DESK0.y) < 40,
    );
    if (sitter) {
      return { ok: true, sitter, snap, waitedMs: Date.now() - started };
    }
    const anyNear = (snap?.agents || []).find(
      (a) => Math.hypot(a.x - DESK0.x, a.y - DESK0.y) < 60,
    );
    if (anyNear) best = anyNear;
    await sleep(2500);
  }
  return { ok: false, best, waitedMs: Date.now() - started };
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
  await sleep(1400);
}

async function clearFocus(page) {
  await page.evaluate(() => {
    window.__hermesSitDebug = false;
    window.__hermesIsoDebug = false;
    window.__hermesFrontDebug = false;
  });
  await sleep(400);
}

async function capture(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await seedStorage(page);
  await connectOffice(page);
  const canvasWait = await waitForCanvas(page);
  if (!canvasWait.ok) {
    fs.writeFileSync(
      path.join(OUT, "hermes3d-seated-mesh-desk0-qa.json"),
      JSON.stringify(
        {
          ok: false,
          error: "no_canvas_or_agents",
          canvas: canvasWait.canvas,
          agents: canvasWait.agents,
        },
        null,
        2,
      ),
    );
    await browser.close();
    process.exit(2);
  }

  const sit = await waitDesk0Sitting(page);
  const focus = sit.sitter
    ? { x: sit.sitter.x, y: sit.sitter.y }
    : { x: DESK0.x, y: DESK0.y };
  const facing = typeof sit.sitter?.facing === "number" ? sit.sitter.facing : 0;

  // Warm sit blend fully before capture.
  await sleep(2000);

  await focusMode(page, "side", focus.x, focus.y, facing);
  await capture(page, "hermes3d-seated-mesh-desk0-side.png");

  await focusMode(page, "front", focus.x, focus.y, facing);
  await capture(page, "hermes3d-seated-mesh-desk0-front.png");

  await focusMode(page, "iso", focus.x, focus.y, facing);
  await capture(page, "hermes3d-seated-mesh-desk0-iso.png");

  await clearFocus(page);
  await capture(page, "hermes3d-seated-mesh-desk0-context.png");

  const report = {
    at: new Date().toISOString(),
    desk: DESK0.id,
    sitOk: sit.ok,
    waitedMs: sit.waitedMs,
    focus,
    facing,
    sitter: sit.sitter
      ? {
          id: sit.sitter.id,
          x: sit.sitter.x,
          y: sit.sitter.y,
          state: sit.sitter.state,
          facing: sit.sitter.facing,
        }
      : null,
    byState: sit.snap?.byState ?? null,
    errors: [...new Set(consoleErrors)].slice(0, 40),
    captures: [
      "hermes3d-seated-mesh-desk0-side.png",
      "hermes3d-seated-mesh-desk0-front.png",
      "hermes3d-seated-mesh-desk0-iso.png",
      "hermes3d-seated-mesh-desk0-context.png",
    ],
    note: "Visual PASS required before extending to eight desks.",
  };
  fs.writeFileSync(
    path.join(OUT, "hermes3d-seated-mesh-desk0-qa.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(sit.ok ? 0 : 3);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

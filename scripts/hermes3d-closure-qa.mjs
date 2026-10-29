/**
 * FINAL VISUAL CLOSURE QA — per-desk iso + side captures, brand, roadmap, runtime.
 * Does not declare PASS; writes artifacts for human/agent visual review.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.HERMES_URL || "http://127.0.0.1:3000";
const GATEWAY = process.env.HERMES_GATEWAY || "http://127.0.0.1:7770";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKS = [
  { id: "desk_0", x: 132, y: 274 },
  { id: "desk_1", x: 332, y: 274 },
  { id: "desk_2", x: 532, y: 274 },
  { id: "desk_3", x: 732, y: 274 },
  { id: "desk_4", x: 132, y: 474 },
  { id: "desk_5", x: 322, y: 474 },
  { id: "desk_6", x: 532, y: 474 },
  { id: "desk_7", x: 732, y: 474 },
];

async function seedStorage(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("hermes3d:onboarding:completed", "true");
      localStorage.setItem("hermes3d.graphicsQuality", "eco");
      localStorage.setItem("hermes-office-render-mode-v1", "3d");
      // Drop legacy furniture so v10 aisle-clear chairs load from defaults.
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
  while (Date.now() - start < timeout) {
    if ((await page.locator("canvas").count()) > 0) {
      await sleep(8000);
      return true;
    }
    await sleep(2000);
  }
  return false;
}

async function waitSitting(page, minSitting = 6, maxMs = 150000) {
  const started = Date.now();
  let best = { sitting: 0, snap: null };
  while (Date.now() - started < maxMs) {
    const snap = await page.evaluate(() => window.__hermesRenderSnapshot);
    const sitting = snap?.byState?.sitting ?? 0;
    if (sitting > best.sitting) best = { sitting, snap };
    if (sitting >= minSitting) return { ok: true, snap, waitedMs: Date.now() - started };
    await sleep(2500);
  }
  return { ok: false, snap: best.snap, bestSitting: best.sitting, waitedMs: Date.now() - started };
}

async function focusIso(page, x, y) {
  await page.evaluate(({ x, y }) => {
    window.__hermesSitDebug = false;
    window.__hermesIsoDebug = true;
    window.__hermesSitDebugFocus = { x, y };
  }, { x, y });
  await sleep(1400);
}

async function focusSide(page, x, y) {
  await page.evaluate(({ x, y }) => {
    window.__hermesIsoDebug = false;
    window.__hermesSitDebug = true;
    window.__hermesSitDebugFocus = { x, y };
  }, { x, y });
  await sleep(1200);
}

async function clearFocus(page) {
  await page.evaluate(() => {
    window.__hermesSitDebug = false;
    window.__hermesIsoDebug = false;
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
  const hasCanvas = await waitForCanvas(page);
  if (!hasCanvas) {
    fs.writeFileSync(
      path.join(OUT, "hermes3d-closure-qa.json"),
      JSON.stringify({ ok: false, error: "no_canvas" }, null, 2),
    );
    await browser.close();
    process.exit(2);
  }

  const sit = await waitSitting(page, 6);
  // True overview — do not leave iso/side debug engaged.
  await clearFocus(page);
  await sleep(1500);
  await capture(page, "hermes3d-closure-full-office.png");

  // Brand + roadmap wall (north wall) via side elevation for legibility.
  await focusSide(page, 420, 18);
  await capture(page, "hermes3d-closure-business-sign.png");
  await focusSide(page, 760, 18);
  await capture(page, "hermes3d-closure-roadmap-wall.png");
  await focusIso(page, 590, 40);
  await capture(page, "hermes3d-closure-brand-roadmap-wall.png");
  await clearFocus(page);

  const deskReports = [];
  for (const desk of DESKS) {
    // Prefer the live sitter coords so the side cam frames the hips/chair.
    const liveSnap = await page.evaluate(() => window.__hermesRenderSnapshot);
    const sitter = (liveSnap?.agents || []).find(
      (a) =>
        a.state === "sitting" &&
        Math.hypot(a.x - desk.x, a.y - desk.y) < 90,
    );
    const focus = sitter
      ? { x: sitter.x, y: sitter.y }
      : { x: desk.x, y: desk.y };
    await focusIso(page, focus.x, focus.y);
    await capture(page, `hermes3d-closure-${desk.id}-iso.png`);
    await focusSide(page, focus.x, focus.y);
    await capture(page, `hermes3d-closure-${desk.id}-side.png`);
    await clearFocus(page);
    deskReports.push({
      desk: desk.id,
      focus,
      nearbySitting: sitter ? [sitter.id] : [],
    });
  }

  // Open roadmap panel via QA event hook.
  let roadmapPanel = false;
  try {
    await clearFocus(page);
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("finactiva-roadmap-open"));
    });
    await sleep(1200);
    roadmapPanel = await page
      .locator("text=FINACTIVA BUSINESS — ROADMAP")
      .count()
      .then((n) => n > 0);
    if (roadmapPanel) {
      await capture(page, "hermes3d-closure-roadmap-panel.png");
    }
  } catch {
    /* ignore */
  }

  // Chat / selection smoke.
  let chatOk = false;
  let selectOk = false;
  try {
    const chatBtn = page.getByRole("button", { name: /CHAT/i });
    if (await chatBtn.isVisible().catch(() => false)) {
      await chatBtn.click({ force: true });
      await sleep(500);
      chatOk = true;
      await capture(page, "hermes3d-closure-chat.png");
    }
    const agentBtn = page.locator("text=/AGENTS/i").first();
    selectOk = (await page.locator("text=CONNECTED").count()) > 0;
  } catch {
    /* ignore */
  }

  let roadmapMeta = null;
  try {
    roadmapMeta = await page.evaluate(async () => {
      const res = await fetch("/api/finactiva-roadmap", { cache: "no-store" });
      return res.json();
    });
  } catch (err) {
    roadmapMeta = { error: String(err) };
  }

  const header = await page.locator("text=FINACTIVA HQ").count();
  const customOk = (await page.locator("text=CONNECTED").count()) > 0;
  const agents10 =
    (sit.snap?.agents?.length ?? 0) === 10 ||
    (await page.locator("text=10 AGENTS").count()) > 0;

  const report = {
    at: new Date().toISOString(),
    header: header > 0 ? "FINACTIVA HQ" : null,
    customOk,
    agents10,
    chatPanel: chatOk,
    selectOk,
    sitWait: { ok: sit.ok, waitedMs: sit.waitedMs, bestSitting: sit.bestSitting },
    byState: sit.snap?.byState ?? null,
    agents: sit.snap?.agents ?? null,
    deskReports,
    roadmapTaskCount: roadmapMeta?.tasks?.length ?? null,
    roadmapEmpty: roadmapMeta?.emptyReason ?? null,
    roadmapSource: roadmapMeta?.source ?? null,
    roadmapPanel,
    errors: [...new Set(consoleErrors)].slice(0, 40),
    note: "Visual PASS/FAIL requires reviewing per-desk iso+side PNGs — sitting=true alone is insufficient.",
  };

  fs.writeFileSync(
    path.join(OUT, "hermes3d-closure-qa.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

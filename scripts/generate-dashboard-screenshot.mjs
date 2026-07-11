import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceHtml = path.resolve(".agentlens", "launch", "support-agent.html");
const outputPng = path.resolve("docs", "assets", "dashboard-screenshot.png");
const profileDir = path.resolve(".agentlens", "dashboard-screenshot-profile");
const viewport = "1280,1400";

function fail(message) {
  throw new Error(message);
}

function commandWorks(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5000
  });
  return result.status === 0;
}

function findBrowser() {
  const candidates = [
    process.env.AGENTLENS_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "chrome.exe",
    "msedge",
    "chrome",
    "google-chrome",
    "chromium",
    "chromium-browser"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if ((candidate.includes(path.sep) || candidate.endsWith(".exe")) && !fs.existsSync(candidate)) continue;
    if (commandWorks(candidate, ["--version"])) return candidate;
  }

  fail("Could not find Edge/Chrome/Chromium. Set AGENTLENS_BROWSER to a browser executable.");
}

function ensureLaunchDemo() {
  const result = spawnSync(process.execPath, ["./scripts/launch-demo.mjs"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000
  });
  if (result.status !== 0) fail(`Launch demo failed:\n${result.stdout}\n${result.stderr}`);
  if (!fs.existsSync(sourceHtml)) fail(`Missing launch dashboard: ${sourceHtml}`);

  const html = fs.readFileSync(sourceHtml, "utf8");
  if (!html.includes("Workflow Review") || html.includes("0 chains / 0 tasks / 0 errors")) {
    fail("Launch dashboard must include non-empty Workflow Review content before screenshot capture.");
  }
}

function screenshot(browser) {
  fs.rmSync(profileDir, { recursive: true, force: true });
  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPng), { recursive: true });

  const result = spawnSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-sync",
      "--no-first-run",
      "--hide-scrollbars",
      `--user-data-dir=${profileDir}`,
      `--window-size=${viewport}`,
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=1000",
      `--screenshot=${outputPng}`,
      pathToFileURL(sourceHtml).href
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20000
    }
  );

  if (result.status !== 0 || !fs.existsSync(outputPng)) {
    fail(`Browser screenshot failed:\n${result.stdout}\n${result.stderr}`);
  }
}

ensureLaunchDemo();
screenshot(findBrowser());

const sizeKb = fs.statSync(outputPng).size / 1024;
if (sizeKb > 1024) fail(`Generated screenshot is ${sizeKb.toFixed(1)} KB, expected <= 1024 KB.`);

console.log(`Wrote ${path.relative(process.cwd(), outputPng)} (${sizeKb.toFixed(1)} KB)`);

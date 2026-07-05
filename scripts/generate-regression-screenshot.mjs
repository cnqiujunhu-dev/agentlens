import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceHtml = path.resolve(".agentlens", "regression-pr", "reports", "diff.html");
const outputPng = path.resolve("docs", "assets", "regression-pr-diff.png");
const profileDir = path.resolve(".agentlens", "regression-screenshot-profile");
const viewport = "1280,860";

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

function ensureRegressionDemo() {
  const result = spawnSync(process.execPath, ["./scripts/regression-pr-demo.mjs"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000
  });
  if (result.status !== 0) fail(`Regression PR demo failed:\n${result.stdout}\n${result.stderr}`);
  if (!fs.existsSync(sourceHtml)) fail(`Missing regression PR diff dashboard: ${sourceHtml}`);
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

ensureRegressionDemo();
screenshot(findBrowser());

const sizeKb = fs.statSync(outputPng).size / 1024;
if (sizeKb > 1024) fail(`Generated screenshot is ${sizeKb.toFixed(1)} KB, expected <= 1024 KB.`);

console.log(`Wrote ${path.relative(process.cwd(), outputPng)} (${sizeKb.toFixed(1)} KB)`);

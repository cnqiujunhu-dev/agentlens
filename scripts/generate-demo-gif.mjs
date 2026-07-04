import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const framesDir = path.resolve(".agentlens", "release-gif-frames");
const outputGif = path.resolve("docs", "assets", "agentlens-demo.gif");
const viewport = "1280,720";
const frameDelay = 180;
const frameFiles = [
  [".agentlens/launch/support-agent.html", "01.png"],
  [".agentlens/launch/mcp-policy.html", "02.png"],
  [".agentlens/launch/langgraph-style.html", "03.png"],
  [".agentlens/launch/unsafe-agent.html", "04.png"]
];

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

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG,
    "D:\\APPS\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe",
    "ffmpeg"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if ((candidate.includes(path.sep) || candidate.endsWith(".exe")) && !fs.existsSync(candidate)) continue;
    if (commandWorks(candidate, ["-version"])) return candidate;
  }

  fail("Could not find ffmpeg. Install ffmpeg or set FFMPEG to the executable path.");
}

function screenshot(browser, htmlFile, outFile) {
  const absoluteHtml = path.resolve(htmlFile);
  if (!fs.existsSync(absoluteHtml)) fail(`Missing launch artifact: ${htmlFile}. Run npm run launch:demo first.`);

  const profileDir = path.join(framesDir, `${path.basename(outFile, ".png")}-profile`);
  fs.mkdirSync(profileDir, { recursive: true });

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
      `--screenshot=${outFile}`,
      pathToFileURL(absoluteHtml).href
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 20000
    }
  );

  if (result.status !== 0 || !fs.existsSync(outFile)) {
    fail(`Browser screenshot failed for ${htmlFile}:\n${result.stdout}\n${result.stderr}`);
  }
}

function makeGif(ffmpeg) {
  const palette = path.join(framesDir, "palette.png");
  const inputPattern = path.join(framesDir, "%02d.png");

  const paletteResult = spawnSync(
    ffmpeg,
    ["-y", "-framerate", "1", "-i", inputPattern, "-vf", "palettegen=stats_mode=diff", palette],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
  if (paletteResult.status !== 0) fail(`ffmpeg palette generation failed:\n${paletteResult.stderr}`);

  const gifResult = spawnSync(
    ffmpeg,
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      inputPattern,
      "-i",
      palette,
      "-lavfi",
      `fps=8,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3,setpts=${frameDelay}*PTS`,
      "-loop",
      "0",
      outputGif
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 }
  );
  if (gifResult.status !== 0) fail(`ffmpeg GIF generation failed:\n${gifResult.stderr}`);
}

fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
fs.mkdirSync(path.dirname(outputGif), { recursive: true });

const browser = findBrowser();
const ffmpeg = findFfmpeg();

for (const [htmlFile, frameName] of frameFiles) {
  screenshot(browser, htmlFile, path.join(framesDir, frameName));
}

makeGif(ffmpeg);

const sizeMb = fs.statSync(outputGif).size / (1024 * 1024);
if (sizeMb > 10) fail(`Generated GIF is ${sizeMb.toFixed(2)} MB, expected <= 10 MB.`);

console.log(`Wrote ${path.relative(process.cwd(), outputGif)} (${sizeMb.toFixed(2)} MB)`);

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-pack-smoke-"));
const packDir = path.join(tmp, "pack");
const projectDir = path.join(tmp, "project");
const npmCache = path.join(tmp, "npm-cache");

function npmCommand() {
  if (process.env.npm_execpath) return [process.execPath, [process.env.npm_execpath]];
  return process.platform === "win32" ? ["npm.cmd", []] : ["npm", []];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_cache: npmCache,
      npm_config_fund: "false",
      npm_config_update_notifier: "false",
      ...(options.env ?? {})
    }
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
  return result;
}

function assertExists(file) {
  if (!fs.existsSync(file)) throw new Error(`Expected file to exist: ${file}`);
}

function assertText(file, snippet) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(snippet)) throw new Error(`${file} missing ${snippet}`);
}

fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(projectDir, { recursive: true });

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const [npm, npmBaseArgs] = npmCommand();

run(npm, [...npmBaseArgs, "pack", "--pack-destination", packDir]);
const tarballs = fs.readdirSync(packDir).filter((file) => file.endsWith(".tgz"));
if (tarballs.length !== 1) throw new Error(`Expected one npm pack tarball, found ${tarballs.length}`);

const tarball = path.join(packDir, tarballs[0]);
if (!tarballs[0].includes(`${packageJson.name}-${packageJson.version}`)) {
  throw new Error(`Unexpected tarball name: ${tarballs[0]}`);
}

fs.writeFileSync(
  path.join(projectDir, "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  "utf8"
);

run(npm, [...npmBaseArgs, "install", "--no-audit", "--no-fund", tarball], { cwd: projectDir });

const installedRoot = path.join(projectDir, "node_modules", packageJson.name);
const bin = path.join(installedRoot, "bin", "agentlens.js");
assertExists(bin);
assertText(path.join(installedRoot, "README.md"), "agentlens quickstart");
assertText(path.join(installedRoot, "README.zh-CN.md"), "快速演示");

run(process.execPath, [bin, "quickstart", "--python"], { cwd: projectDir, stdio: "inherit" });

const quickstartDir = path.join(projectDir, ".agentlens", "quickstart");
const traceFile = path.join(quickstartDir, "runs", "demo.json");
assertExists(traceFile);
assertExists(path.join(quickstartDir, "reports", "dashboard.html"));
assertExists(path.join(quickstartDir, "reports", "bundle", "index.html"));
assertExists(path.join(quickstartDir, "reports", "pr-comment.md"));
assertExists(path.join(quickstartDir, "share", "demo", "summary.md"));
assertExists(path.join(projectDir, ".agentlens", "python", "basic_run.py"));
assertExists(path.join(projectDir, ".agentlens", "examples", "python-github-action.yml"));

run(process.execPath, [bin, "validate", "trace", traceFile], { cwd: projectDir, stdio: "inherit" });
run(process.execPath, [bin, "otel-batch", path.join(quickstartDir, "runs"), "--out", path.join(quickstartDir, "reports", "otel")], {
  cwd: projectDir,
  stdio: "inherit"
});
assertExists(path.join(quickstartDir, "reports", "otel", "manifest.json"));

run(process.execPath, [
  "--input-type=module",
  "-e",
  "const m = await import('agentlens'); if (!m.createRun || !m.runQuickstart || !m.writeOtelBatch) throw new Error('missing public exports');"
], { cwd: projectDir });

console.log(`Pack install smoke passed: ${tarball}`);

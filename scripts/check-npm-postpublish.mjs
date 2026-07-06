import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultRegistry = "https://registry.npmjs.org/";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-npm-postpublish-"));
const projectDir = path.join(tmp, "project");
const npmCache = path.join(tmp, "npm-cache");

function usage() {
  return [
    "Usage: node scripts/check-npm-postpublish.mjs [--package-spec spec] [--registry url] [--version version]",
    "",
    "Defaults to checking agentlens-devtools@package.json version from the public npm registry.",
    "Use --package-spec path/to/agentlens-devtools-x.y.z.tgz to validate the script before publishing."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    registry: defaultRegistry
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--package-spec") {
      options.packageSpec = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--registry") {
      options.registry = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--version") {
      options.version = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}\n${usage()}`);
  }
  return options;
}

function npmCommand() {
  if (process.env.npm_execpath) return [process.execPath, [process.env.npm_execpath]];
  return process.platform === "win32" ? ["npm.cmd", []] : ["npm", []];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectDir,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_cache: npmCache,
      npm_config_fund: "false",
      npm_config_registry: options.registry ?? defaultRegistry,
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

function isLocalPackageSpec(spec) {
  return spec.endsWith(".tgz") || fs.existsSync(path.resolve(root, spec)) || fs.existsSync(spec);
}

function resolvePackageSpec(spec) {
  if (!isLocalPackageSpec(spec)) return spec;
  if (fs.existsSync(spec)) return path.resolve(spec);
  return path.resolve(root, spec);
}

function assertQuickstartArtifacts() {
  const quickstartDir = path.join(projectDir, ".agentlens", "quickstart");
  const traceFile = path.join(quickstartDir, "runs", "demo.json");
  assertExists(traceFile);
  assertExists(path.join(quickstartDir, "reports", "dashboard.html"));
  assertExists(path.join(quickstartDir, "reports", "bundle", "index.html"));
  assertExists(path.join(quickstartDir, "reports", "pr-comment.md"));
  assertExists(path.join(quickstartDir, "share", "demo", "summary.md"));
  assertExists(path.join(projectDir, ".agentlens", "python", "basic_run.py"));
  assertExists(path.join(projectDir, ".agentlens", "examples", "python-github-action.yml"));
  return { quickstartDir, traceFile };
}

const options = parseArgs(process.argv.slice(2));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expectedVersion = options.version ?? packageJson.version;
const packageSpec = resolvePackageSpec(options.packageSpec ?? `${packageJson.name}@${expectedVersion}`);
const [npm, npmBaseArgs] = npmCommand();

if (!isLocalPackageSpec(packageSpec)) {
  const view = run(npm, [...npmBaseArgs, "view", `${packageJson.name}@${expectedVersion}`, "version", "--json"], {
    cwd: root,
    registry: options.registry
  });
  const publishedVersion = JSON.parse(view.stdout);
  if (publishedVersion !== expectedVersion) {
    throw new Error(`Expected ${packageJson.name}@${expectedVersion} on npm, found ${publishedVersion}`);
  }
}

fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(
  path.join(projectDir, "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  "utf8"
);

run(npm, [...npmBaseArgs, "exec", "--yes", "--package", packageSpec, "--", "agentlens", "quickstart", "--python"], {
  registry: options.registry,
  stdio: "inherit"
});
const { quickstartDir, traceFile } = assertQuickstartArtifacts();

run(npm, [...npmBaseArgs, "install", "--no-audit", "--no-fund", packageSpec], {
  registry: options.registry
});

const installedRoot = path.join(projectDir, "node_modules", packageJson.name);
const installedPackageJson = JSON.parse(fs.readFileSync(path.join(installedRoot, "package.json"), "utf8"));
if (installedPackageJson.name !== packageJson.name) throw new Error(`Installed package name mismatch: ${installedPackageJson.name}`);
if (installedPackageJson.version !== expectedVersion) throw new Error(`Installed package version mismatch: ${installedPackageJson.version}`);
if (installedPackageJson.bin?.agentlens !== "bin/agentlens.js") throw new Error("Installed package missing agentlens bin");

const bin = path.join(installedRoot, "bin", "agentlens.js");
const binShim = path.join(
  projectDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "agentlens.cmd" : "agentlens"
);
assertExists(bin);
assertExists(binShim);
assertText(path.join(installedRoot, "README.md"), "npm exec --package agentlens-devtools");
assertText(path.join(installedRoot, "README.zh-CN.md"), "agentlens-devtools");

run(npm, [...npmBaseArgs, "exec", "--", "agentlens", "validate", "trace", traceFile], {
  registry: options.registry,
  stdio: "inherit"
});
run(npm, [...npmBaseArgs, "exec", "--", "agentlens", "otel-batch", path.join(quickstartDir, "runs"), "--out", path.join(quickstartDir, "reports", "otel")], {
  registry: options.registry,
  stdio: "inherit"
});
assertExists(path.join(quickstartDir, "reports", "otel", "manifest.json"));

run(process.execPath, [
  "--input-type=module",
  "-e",
  `const m = await import(${JSON.stringify(packageJson.name)}); if (!m.createRun || !m.runQuickstart || !m.writeOtelBatch) throw new Error('missing public exports');`
], { registry: options.registry });

console.log(`npm post-publish smoke passed for ${packageSpec}`);

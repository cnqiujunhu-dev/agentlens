import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const npmRegistry = "https://registry.npmjs.org/";
const requiredPackageFiles = [
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "bin/agentlens.js",
  "src/index.js",
  "docs/API.md",
  "docs/NPM_PUBLISHING.md",
  "docs/MARKET_ANALYSIS.md",
  "docs/PR_COMMENT_EXAMPLE.md",
  "docs/RELEASE_NOTES_V0.4.0.md",
  "docs/assets/agentlens-demo.gif",
  "docs/assets/dashboard-screenshot.png",
  "docs/assets/regression-pr-diff.png",
  "python/agentlens-trace/pyproject.toml",
  "python/agentlens-trace/README.md",
  "python/agentlens-trace/src/agentlens_trace/__init__.py",
  "python/agentlens-trace/src/agentlens_trace/__main__.py",
  "python/agentlens-trace/src/agentlens_trace/adapters/__init__.py",
  "python/agentlens-trace/src/agentlens_trace/adapters/__main__.py",
  "scripts/check-npm-publish.mjs",
  "scripts/check-npm-postpublish.mjs",
  "scripts/check-pack-install.mjs",
  "package.json"
];

const forbiddenPackageFiles = [
  "python/agentlens-trace/build/",
  "python/agentlens-trace/dist/",
  "python/agentlens-trace/src/agentlens_trace.egg-info/",
  "__pycache__/"
];

function npmCommand() {
  if (process.env.npm_execpath) return [process.execPath, [process.env.npm_execpath]];
  return process.platform === "win32" ? ["npm.cmd", []] : ["npm", []];
}

function fail(message) {
  throw new Error(message);
}

function runNpm(args) {
  const [npm, npmBaseArgs] = npmCommand();
  const result = spawnSync(npm, [...npmBaseArgs, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_registry: npmRegistry,
      npm_config_update_notifier: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    fail(`npm ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
  assertNoNpmAutocorrect(result.stderr ?? "", `npm ${args.join(" ")}`);
  return result;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${label} did not return parseable JSON: ${error.message}\n${text}`);
  }
}

function assertNoNpmAutocorrect(stderr, label) {
  for (const forbidden of [
    "npm auto-corrected",
    "errors corrected",
    "script name was invalid",
    "invalid and removed",
    "script name was cleaned"
  ]) {
    if (stderr.includes(forbidden)) fail(`${label} reported npm package auto-correction: ${forbidden}\n${stderr}`);
  }
}

function assertText(file, snippet) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(snippet)) fail(`${file} missing ${snippet}`);
}

function assertNoText(file, snippet) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (text.includes(snippet)) fail(`${file} must not include ${snippet}`);
}

function assertPackageJson(packageJson) {
  if (packageJson.name !== "agentlens-devtools") fail("package.json name must be agentlens-devtools");
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) fail("package.json version must be semver");
  if (packageJson.private) fail("package.json must not be private");
  if (packageJson.license !== "Apache-2.0") fail("package.json license must be Apache-2.0");
  if (packageJson.type !== "module") fail("package.json type must be module");
  if (packageJson.main !== "./src/index.js") fail("package.json main must be ./src/index.js");
  if (packageJson.bin?.agentlens !== "bin/agentlens.js") fail("package.json bin.agentlens must be bin/agentlens.js");
  if (packageJson.repository?.url !== "git+https://github.com/cnqiujunhu-dev/agentlens.git") {
    fail("package.json repository.url must point to the public GitHub repository");
  }
  if (packageJson.bugs?.url !== "https://github.com/cnqiujunhu-dev/agentlens/issues") {
    fail("package.json bugs.url must point to GitHub issues");
  }
  if (packageJson.homepage !== "https://github.com/cnqiujunhu-dev/agentlens#readme") {
    fail("package.json homepage must point to the GitHub README");
  }
  if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
    fail("package.json must keep zero runtime dependencies");
  }
  for (const key of [".", "./quickstart", "./otel", "./adapters/llm", "./adapters/mcp-stdio"]) {
    if (!packageJson.exports?.[key]) fail(`package.json missing export ${key}`);
  }
  for (const file of [
    "bin",
    "src",
    "docs",
    "examples",
    "python/agentlens-trace/pyproject.toml",
    "python/agentlens-trace/README.md",
    "python/agentlens-trace/src/agentlens_trace/__init__.py",
    "python/agentlens-trace/src/agentlens_trace/__main__.py",
    "python/agentlens-trace/src/agentlens_trace/adapters/__init__.py",
    "python/agentlens-trace/src/agentlens_trace/adapters/__main__.py",
    "README.md",
    "README.zh-CN.md",
    "LICENSE"
  ]) {
    if (!packageJson.files?.includes(file)) fail(`package.json files missing ${file}`);
  }
}

function assertDocs() {
  assertText("README.md", "npm exec --package agentlens-devtools -- agentlens quickstart --python");
  assertText("README.md", "Do not use `npm install agentlens`");
  assertText("README.zh-CN.md", "npm exec --package agentlens-devtools -- agentlens quickstart --python");
  assertText("docs/API.md", 'from "agentlens-devtools"');
  assertText("docs/NPM_PUBLISHING.md", "npm run npm:publish:check");
  assertText("docs/NPM_PUBLISHING.md", "npm run npm:postpublish:check");
  assertText("docs/NPM_PUBLISHING.md", "npm publish --dry-run");
  assertText("docs/NPM_PUBLISHING.md", "npm publish --access public");
  assertText("docs/RELEASE_CHECKLIST.md", "npm run npm:publish:check");
  assertText("docs/RELEASE_CHECKLIST.md", "npm run npm:postpublish:check");
  assertNoText("docs/API.md", 'from "agentlens"');
}

function assertManifest(manifest, packageJson, label) {
  const pack = Array.isArray(manifest) ? manifest[0] : manifest;
  if (!pack || typeof pack !== "object") fail(`${label} returned an unexpected manifest shape`);
  if (pack.name !== packageJson.name) fail(`${label} package name mismatch: ${pack.name}`);
  if (pack.version !== packageJson.version) fail(`${label} package version mismatch: ${pack.version}`);
  if (pack.filename !== `${packageJson.name}-${packageJson.version}.tgz`) fail(`${label} filename mismatch: ${pack.filename}`);
  if (pack.id && pack.id !== `${packageJson.name}@${packageJson.version}`) fail(`${label} package id mismatch: ${pack.id}`);
  const files = new Set((pack.files ?? []).map((file) => file.path));
  for (const file of requiredPackageFiles) {
    if (!files.has(file)) fail(`${label} missing packed file: ${file}`);
  }
  for (const file of files) {
    for (const forbidden of forbiddenPackageFiles) {
      if (file.startsWith(forbidden)) fail(`${label} must not include generated Python package artifact: ${file}`);
      if (file.includes(forbidden)) fail(`${label} must not include generated Python package artifact: ${file}`);
    }
    if (file.endsWith(".pyc")) fail(`${label} must not include generated Python bytecode: ${file}`);
  }
  if (files.has("package-lock.json")) fail(`${label} must not include package-lock.json`);
  if (files.has(".github/workflows/ci.yml")) fail(`${label} must not include CI internals`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assertPackageJson(packageJson);
assertDocs();

const packResult = runNpm(["pack", "--dry-run", "--json"]);
assertManifest(parseJson(packResult.stdout, "npm pack --dry-run --json"), packageJson, "npm pack --dry-run");

const publishResult = runNpm(["publish", "--dry-run", "--json", "--registry", npmRegistry]);
assertManifest(parseJson(publishResult.stdout, "npm publish --dry-run --json"), packageJson, "npm publish --dry-run");

console.log(`npm publish check passed for ${packageJson.name}@${packageJson.version}`);

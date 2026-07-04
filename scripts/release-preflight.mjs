import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const localMode = args.has("--local");
const skipVerify = args.has("--skip-verify");
const allowDirty = args.has("--allow-dirty");

const checks = [];

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false"
    }
  });
}

function runNpm(commandArgs, options = {}) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...commandArgs], options);
  }
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", "npm", ...commandArgs], options);
  }
  return run("npm", commandArgs, options);
}

function add(status, id, message) {
  checks.push({ status, id, message });
}

function pass(id, message) {
  add("pass", id, message);
}

function warn(id, message) {
  add("warn", id, message);
}

function fail(id, message) {
  add("fail", id, message);
}

function commandText(command, commandArgs) {
  const result = run(command, commandArgs);
  return {
    ok: result.status === 0,
    text: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  };
}

function packageVersion() {
  return JSON.parse(fs.readFileSync("package.json", "utf8")).version;
}

function githubRepoFromRemote(remoteUrl) {
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+\/[^.]+)(?:\.git)?$/);
  if (ssh) return ssh[1];
  const https = remoteUrl.match(/^https:\/\/github\.com\/([^/]+\/[^.]+)(?:\.git)?$/);
  if (https) return https[1];
  return null;
}

function checkCleanWorktree() {
  const status = commandText("git", ["status", "--short"]);
  if (!status.ok) {
    fail("git-status", status.text || "git status failed");
    return;
  }
  if (!status.text) {
    pass("git-status", "working tree is clean");
  } else if (allowDirty) {
    warn("git-status", "working tree has changes; allowed for local preflight");
  } else {
    fail("git-status", "working tree must be clean before release");
  }
}

function remoteUrl() {
  const remote = commandText("git", ["remote", "get-url", "origin"]);
  if (remote.ok && remote.text) {
    pass("git-remote", `origin is configured: ${remote.text}`);
    return remote.text;
  } else if (localMode) {
    warn("git-remote", "origin is not configured; required before public release");
  } else {
    fail("git-remote", "origin remote is required before public release");
  }
  return null;
}

function checkGitHubAuth() {
  const status = commandText("gh", ["auth", "status"]);
  if (!status.ok) {
    if (localMode) warn("github-auth", "gh auth status failed; required before publishing");
    else fail("github-auth", "gh auth status failed; required before publishing");
    return;
  }

  const scopeLine = status.text.split(/\r?\n/).find((line) => line.includes("Token scopes:")) ?? "";
  const hasWorkflow = scopeLine.includes("workflow");
  if (hasWorkflow) {
    pass("github-auth", "GitHub token includes workflow scope");
  } else if (localMode) {
    warn("github-auth", "GitHub token is missing workflow scope; run: gh auth refresh -s workflow");
  } else {
    fail("github-auth", "GitHub token is missing workflow scope; run: gh auth refresh -s workflow");
  }
}

function checkRemoteBranch(remote) {
  const repo = remote ? githubRepoFromRemote(remote) : null;
  if (!repo) {
    if (localMode) warn("github-default-branch", "origin is not a GitHub remote that preflight can inspect");
    else fail("github-default-branch", "origin must be a GitHub remote");
    return;
  }

  const result = commandText("gh", ["repo", "view", repo, "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"]);
  if (result.ok && result.text) {
    pass("github-default-branch", `remote default branch is ${result.text}`);
  } else if (localMode) {
    warn("github-default-branch", "remote has no default branch yet; push main before release");
  } else {
    fail("github-default-branch", "remote has no default branch yet; push main before release");
  }
}

function checkTag() {
  const expected = `v${packageVersion()}`;
  const tag = commandText("git", ["tag", "--points-at", "HEAD"]);
  const tags = tag.text.split(/\s+/).filter(Boolean);
  if (tags.includes(expected)) {
    pass("git-tag", `HEAD is tagged ${expected}`);
  } else if (localMode) {
    warn("git-tag", `HEAD is not tagged ${expected}; required before public release`);
  } else {
    fail("git-tag", `HEAD must be tagged ${expected}`);
  }
}

function checkDemoGif() {
  const file = "docs/assets/agentlens-demo.gif";
  if (!fs.existsSync(file)) {
    fail("demo-gif", `${file} is missing`);
    return;
  }
  const size = fs.statSync(file).size;
  if (size > 10 * 1024 * 1024) {
    fail("demo-gif", `${file} is larger than 10 MB`);
    return;
  }
  pass("demo-gif", `${file} exists and is ${(size / 1024).toFixed(1)} KB`);
}

function runReleaseAudit() {
  const result = runNpm(["run", "release:audit"]);
  if (result.status === 0) pass("release-audit", "npm run release:audit passed");
  else fail("release-audit", result.stderr || result.stdout || "npm run release:audit failed");
}

function runVerify() {
  if (skipVerify) {
    warn("verify", "npm run verify skipped");
    return;
  }
  const result = runNpm(["run", "verify"], { stdio: "inherit" });
  if (result.status === 0) pass("verify", "npm run verify passed");
  else fail("verify", "npm run verify failed");
}

checkCleanWorktree();
const origin = remoteUrl();
checkGitHubAuth();
checkRemoteBranch(origin);
checkTag();
checkDemoGif();
runReleaseAudit();
runVerify();

const failed = checks.filter((check) => check.status === "fail");
const warned = checks.filter((check) => check.status === "warn");

console.log("AgentLens Release Preflight");
for (const check of checks) {
  console.log(`[${check.status.toUpperCase()}] ${check.id}: ${check.message}`);
}

if (failed.length > 0) {
  process.exitCode = 1;
} else if (warned.length > 0) {
  console.log("Preflight completed with warnings.");
} else {
  console.log("Preflight passed.");
}

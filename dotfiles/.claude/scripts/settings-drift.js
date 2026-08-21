#!/usr/bin/env node
/**
 * Report additive-list drift between this machine's live Claude settings and
 * the shared baseline in this repo.
 *
 * WHY THIS EXISTS
 * ~/.claude/settings.json is seeded from settings.base.json exactly once, by
 * install.sh, and is machine-owned from then on. Nothing ever reads the base
 * again. So an entry added to the base after a machine was set up never
 * reaches that machine, and nothing says so. That silence cost a real debug
 * session: "git *" sat in the base for weeks while one machine kept failing
 * to push, because the sandbox had no exclusion for it.
 *
 * WHY ONLY LISTS
 * Most differences between live and base are deliberate -- machines run
 * different plugins, hooks, and output styles. Comparing whole files is all
 * noise. The paths below are different: they are ADDITIVE allow-lists, where
 * a base entry is a decision that should hold everywhere. Comparing only
 * these gives a signal with no false alarms.
 *
 * This never edits anything unless you pass --apply. Machine-owned means
 * machine-owned.
 *
 * Usage:
 *   settings-drift.js --hook     JSON for a SessionStart hook; silent if clean
 *   settings-drift.js --check    Human-readable; exit 1 if drift found
 *   settings-drift.js --apply    Append the missing base entries to live
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Dotted paths whose arrays are additive: an entry in the base is a decision
// that should apply on every machine. Anything not listed here is treated as
// legitimately machine-specific and is never compared.
const ADDITIVE_LISTS = [
  "sandbox.excludedCommands",
  "sandbox.network.allowedDomains",
  "sandbox.network.allowUnixSockets",
  "sandbox.filesystem.allowWrite",
  "permissions.allow",
];

// Overridable so --apply can be exercised against a scratch copy. Nothing in
// normal use sets this; it exists so the write path is testable without
// pointing a test at the real settings file.
const LIVE_PATH =
  process.env.CLAUDE_SETTINGS_DRIFT_TARGET || path.join(os.homedir(), ".claude", "settings.json");

/** Resolve the base next to this script, following the ~/.claude symlink back
 *  into the repo, so a clone anywhere still works. */
function basePath() {
  const realScript = fs.realpathSync(__filename);
  return path.join(path.dirname(path.dirname(realScript)), "settings.base.json");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function getPath(obj, dotted) {
  return dotted.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function setPath(obj, dotted, value) {
  const keys = dotted.split(".");
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

/** For each additive path, the base entries this machine does not have. */
function findDrift(live, base) {
  const drift = [];
  for (const dotted of ADDITIVE_LISTS) {
    const baseList = getPath(base, dotted);
    if (!Array.isArray(baseList)) continue;
    const liveList = getPath(live, dotted);
    const have = new Set(Array.isArray(liveList) ? liveList : []);
    const missing = baseList.filter((entry) => !have.has(entry));
    if (missing.length) drift.push({ path: dotted, missing });
  }
  return drift;
}

function main() {
  const mode = process.argv[2] || "--check";
  let live, base;
  try {
    live = readJson(LIVE_PATH);
    base = readJson(basePath());
  } catch (err) {
    // A missing or half-written settings file must never block a session.
    if (mode === "--check") console.error(`settings-drift: ${err.message}`);
    process.exit(0);
  }

  const drift = findDrift(live, base);

  if (mode === "--hook") {
    if (drift.length) {
      const lines = drift.map((d) => `    ${d.path} missing: ${d.missing.join(", ")}`);
      process.stdout.write(
        JSON.stringify({
          systemMessage:
            "settings drift vs t-configs base:\n" +
            lines.join("\n") +
            "\n  Run ./install.sh --sync-lists to add them.",
        })
      );
    }
    process.exit(0);
  }

  if (mode === "--apply") {
    if (!drift.length) {
      console.log("settings already in sync with the base additive lists.");
      process.exit(0);
    }
    for (const d of drift) {
      const current = getPath(live, d.path);
      setPath(live, d.path, [...(Array.isArray(current) ? current : []), ...d.missing]);
      console.log(`  ${d.path} += ${d.missing.join(", ")}`);
    }
    // Write via a temp file and rename so a crash cannot leave a partial
    // settings.json behind -- Claude Code reads this file constantly.
    const tmp = `${LIVE_PATH}.drift-tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(live, null, 2)}\n`);
    fs.renameSync(tmp, LIVE_PATH);
    console.log(`Updated ${LIVE_PATH}`);
    process.exit(0);
  }

  // --check
  if (!drift.length) {
    console.log("settings: additive lists match the base.");
    process.exit(0);
  }
  console.log("settings drift vs t-configs base:");
  for (const d of drift) console.log(`  ${d.path} missing: ${d.missing.join(", ")}`);
  console.log("Run ./install.sh --sync-lists to add them.");
  process.exit(1);
}

main();

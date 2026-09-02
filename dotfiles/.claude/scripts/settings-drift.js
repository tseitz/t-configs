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
 * WHY KEYS TOO, NOT JUST LISTS
 * The seed above happens only when settings.json does not exist. Claude Code
 * writes that file itself on first launch, so on any machine where it ran
 * before install.sh -- which is every machine set up while using Claude Code --
 * the seed is skipped entirely and install.sh reports "machine-owned, left
 * untouched". The base never lands at all. That is how a machine ends up with
 * no hooks, no statusline and no editorMode while the installer says it is
 * done. --seed backfills top-level keys the machine is MISSING. It never
 * changes a key that is already there, so a different value stays a machine
 * decision.
 *
 * WHY A WORK OVERLAY
 * Work-only plugins and marketplaces live in settings.work.json, which applies
 * only on a machine carrying the dotfiles/.work-machine marker. Without reading
 * it here, every work plugin would look like drift on a work machine and every
 * one would look wanted on a personal machine. "The baseline" below therefore
 * means base, plus the work overlay when the marker is present.
 *
 * Usage:
 *   settings-drift.js --hook     JSON for a SessionStart hook; silent if clean
 *   settings-drift.js --check    Human-readable; exit 1 if drift found
 *   settings-drift.js --apply    Append the missing base entries to live
 *   settings-drift.js --seed     Add base top-level keys absent from live
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

// The map equivalent of ADDITIVE_LISTS: paths where a base KEY should exist
// everywhere, but its VALUE is a machine decision. enabledPlugins is the case
// that forces the distinction — the base deliberately carries `false` entries
// ("tried it, don't want it"), and a plugin switched off on one machine on
// purpose must not be switched back on by a sync. So keys are compared and
// values never are.
const ADDITIVE_KEYS = ["enabledPlugins", "extraKnownMarketplaces"];

// Overridable so --apply can be exercised against a scratch copy. Nothing in
// normal use sets this; it exists so the write path is testable without
// pointing a test at the real settings file.
const LIVE_PATH =
  process.env.CLAUDE_SETTINGS_DRIFT_TARGET || path.join(os.homedir(), ".claude", "settings.json");

/** The repo's .claude directory, found by following the ~/.claude symlink back
 *  into the repo, so a clone anywhere still works. */
function repoClaudeDir() {
  return path.dirname(path.dirname(fs.realpathSync(__filename)));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function mergeDeep(base, overlay) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? mergeDeep(out[key], value) : value;
  }
  return out;
}

/** The baseline this machine should match: settings.base.json, plus
 *  settings.work.json when the work marker is present. */
function readBaseline() {
  const claudeDir = repoClaudeDir();
  const base = readJson(path.join(claudeDir, "settings.base.json"));
  const marker = path.join(path.dirname(claudeDir), ".work-machine");
  if (!fs.existsSync(marker)) return base;
  try {
    return mergeDeep(base, readJson(path.join(claudeDir, "settings.work.json")));
  } catch {
    // A work machine with no work file is a half-finished setup, not a reason to
    // report every base entry as drift. Fall back to the base alone.
    return base;
  }
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

/** Base top-level keys this machine has no entry for at all. A key that exists
 *  with a different value is a machine decision and is never reported. */
function findMissingKeys(live, base) {
  return Object.keys(base).filter((k) => !(k in live));
}

/** For each additive-key path, the base keys absent from this machine's map. */
function findKeyDrift(live, base) {
  const drift = [];
  for (const dotted of ADDITIVE_KEYS) {
    const baseMap = getPath(base, dotted);
    if (!baseMap || typeof baseMap !== "object") continue;
    const liveMap = getPath(live, dotted);
    // No map at all is a whole absent top-level key, which --seed already
    // reports. Flagging it here too would print the same fix twice.
    if (!liveMap || typeof liveMap !== "object") continue;
    const missing = Object.keys(baseMap).filter((k) => !(k in liveMap));
    if (missing.length) drift.push({ path: dotted, missing });
  }
  return drift;
}

/** Write via a temp file and rename so a crash cannot leave a partial
 *  settings.json behind -- Claude Code reads this file constantly. */
function writeLive(live) {
  const tmp = `${LIVE_PATH}.drift-tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(live, null, 2)}\n`);
  fs.renameSync(tmp, LIVE_PATH);
}

function describe(value) {
  if (Array.isArray(value)) return `${value.length} items`;
  if (value && typeof value === "object") return `${Object.keys(value).length} entries`;
  return JSON.stringify(value);
}

function main() {
  const mode = process.argv[2] || "--check";
  let live, base;
  try {
    live = readJson(LIVE_PATH);
    base = readBaseline();
  } catch (err) {
    // A missing or half-written settings file must never block a session.
    if (mode === "--check") console.error(`settings-drift: ${err.message}`);
    process.exit(0);
  }

  const drift = findDrift(live, base);
  const keyDrift = findKeyDrift(live, base);
  const missingKeys = findMissingKeys(live, base);

  if (mode === "--seed") {
    if (!missingKeys.length) {
      console.log("settings: every base key is present.");
      process.exit(0);
    }
    for (const k of missingKeys) {
      live[k] = base[k];
      console.log(`  + ${k} (${describe(base[k])})`);
    }
    writeLive(live);
    console.log(`Seeded ${missingKeys.length} missing key(s) into ${LIVE_PATH}`);
    process.exit(0);
  }

  if (mode === "--hook") {
    if (drift.length || keyDrift.length || missingKeys.length) {
      const lines = [...drift, ...keyDrift].map(
        (d) => `    ${d.path} missing: ${d.missing.join(", ")}`
      );
      if (missingKeys.length) {
        lines.push(`    absent keys: ${missingKeys.join(", ")}`);
        lines.push("  Run ./install.sh --sync-settings to add them.");
      }
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
    if (!drift.length && !keyDrift.length) {
      console.log("settings already in sync with the baseline additive entries.");
      process.exit(0);
    }
    for (const d of drift) {
      const current = getPath(live, d.path);
      setPath(live, d.path, [...(Array.isArray(current) ? current : []), ...d.missing]);
      console.log(`  ${d.path} += ${d.missing.join(", ")}`);
    }
    for (const d of keyDrift) {
      const current = getPath(live, d.path) || {};
      // Copy the baseline's value for a key this machine lacks entirely. Keys it
      // already has are left alone, so a local toggle survives the sync.
      for (const k of d.missing) current[k] = getPath(base, d.path)[k];
      setPath(live, d.path, current);
      console.log(`  ${d.path} += ${d.missing.join(", ")}`);
    }
    // Write via a temp file and rename so a crash cannot leave a partial
    // settings.json behind -- Claude Code reads this file constantly.
    writeLive(live);
    console.log(`Updated ${LIVE_PATH}`);
    process.exit(0);
  }

  // --check
  if (!drift.length && !keyDrift.length && !missingKeys.length) {
    console.log("settings: additive lists, plugin keys and base keys all match.");
    process.exit(0);
  }
  if (drift.length || keyDrift.length) {
    console.log("settings drift vs t-configs baseline:");
    for (const d of [...drift, ...keyDrift]) {
      console.log(`  ${d.path} missing: ${d.missing.join(", ")}`);
    }
    console.log("Run ./install.sh --sync-lists to add them.");
  }
  if (missingKeys.length) {
    console.log("settings keys absent on this machine (base never seeded here):");
    for (const k of missingKeys) console.log(`  ${k} (${describe(base[k])})`);
    console.log("Run ./install.sh --sync-settings to add them.");
  }
  process.exit(1);
}

main();

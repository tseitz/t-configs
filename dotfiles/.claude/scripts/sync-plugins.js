#!/usr/bin/env node
/**
 * Register declared marketplaces, then install missing wanted plugins.
 * Needed because extraKnownMarketplaces alone never registers a marketplace: its plugins fail
 * "not found in marketplace" until `claude plugin marketplace add` runs.
 */
"use strict";

const { execFileSync } = require("child_process");
const { readBaseline } = require("./settings-drift");

/** CLI args that register a declared source, or null for a source `marketplace add` can't express. */
function marketplaceAddArgs(source) {
  let target;
  switch (source.source) {
    case "github":
      target = source.ref ? `${source.repo}@${source.ref}` : source.repo;
      break;
    case "git":
      target = source.ref ? `${source.url}#${source.ref}` : source.url;
      break;
    case "directory":
    case "file":
      target = source.path;
      break;
    case "url":
      if (source.headers || source.headersHelper) return null;
      target = source.url;
      break;
    default:
      return null;
  }
  if (source.path && (source.source === "github" || source.source === "git")) return null;
  const args = ["plugin", "marketplace", "add", target];
  if (source.sparsePaths?.length) args.push("--sparse", ...source.sparsePaths);
  return args;
}

function plan(baseline, registered, installed) {
  const declared = baseline.extraKnownMarketplaces ?? {};
  const wanted = Object.entries(baseline.enabledPlugins ?? {})
    .filter(([, on]) => on)
    .map(([id]) => id);
  return {
    marketplaces: Object.entries(declared)
      .filter(([name]) => !registered.has(name))
      .map(([name, { source }]) => ({ name, args: marketplaceAddArgs(source) })),
    plugins: wanted.filter((id) => !installed.has(id)).sort(),
  };
}

function claudeJson(args) {
  return JSON.parse(execFileSync("claude", args, { encoding: "utf8" }));
}

function main() {
  const registered = new Set(claudeJson(["plugin", "marketplace", "list", "--json"]).map((m) => m.name));
  const installed = new Set(claudeJson(["plugin", "list", "--json"]).map((p) => p.id));
  const { marketplaces, plugins } = plan(readBaseline(), registered, installed);
  const failures = [];

  for (const { name, args } of marketplaces) {
    if (!args) {
      failures.push(`marketplace ${name}: source can't be registered from the CLI — add it by hand`);
      continue;
    }
    try {
      execFileSync("claude", args, { stdio: "inherit" });
    } catch {
      failures.push(`marketplace ${name}: \`claude ${args.join(" ")}\` failed`);
    }
  }
  for (const id of plugins) {
    try {
      execFileSync("claude", ["plugin", "install", id], { stdio: "inherit" });
    } catch {
      failures.push(`plugin ${id}: install failed`);
    }
  }

  if (!marketplaces.length && !plugins.length) console.log("[ok]   marketplaces registered, wanted plugins installed");
  for (const f of failures) console.error(`[fail] ${f}`);
  process.exit(failures.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = { marketplaceAddArgs, plan };

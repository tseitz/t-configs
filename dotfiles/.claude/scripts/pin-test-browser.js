#!/usr/bin/env node
/**
 * Point every browser-driving MCP plugin at Chrome for Testing, so an automated window wears
 * the dock's "Test" badge and never looks like the everyday Chrome.
 *
 * Left alone, Playwright MCP launches /Applications/Google Chrome.app with a throwaway profile:
 * the same icon as the real browser. The pin is a launch argument inside each plugin's cached
 * manifest, and that cache is per plugin version and per machine, so a plugin update or a new
 * machine silently drops it. Hence a script that re-applies it, run by install.sh and on
 * SessionStart. A pin written during SessionStart takes effect on the NEXT session: MCP
 * servers have already launched by then.
 *
 * The browser is Playwright's own download (`npx playwright install chromium`), found by
 * glob because its `chromium-NNNN` directory changes with every Playwright release.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CFT_BINARY = 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

// The flag spelling is each server's own; they are not interchangeable.
const PLUGINS = [
  { plugin: 'chrome-devtools-mcp', manifest: '.claude-plugin/plugin.json',
    servers: (doc) => doc.mcpServers, server: 'chrome-devtools', flag: '--executablePath=' },
  { plugin: 'playwright', manifest: '.mcp.json',
    servers: (doc) => doc, server: 'playwright', flag: '--executable-path=' },
];

function newestTestBrowser(cacheRoot) {
  if (!fs.existsSync(cacheRoot)) return null;
  const builds = fs.readdirSync(cacheRoot)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const build of builds) {
    const binary = path.join(cacheRoot, build, CFT_BINARY);
    if (fs.existsSync(binary)) return binary;
  }
  return null;
}

function manifests(pluginCache, plugin, manifest) {
  if (!fs.existsSync(pluginCache)) return [];
  const found = [];
  for (const marketplace of fs.readdirSync(pluginCache)) {
    const versions = path.join(pluginCache, marketplace, plugin);
    if (!fs.existsSync(versions)) continue;
    for (const version of fs.readdirSync(versions)) {
      const file = path.join(versions, version, manifest);
      if (fs.existsSync(file)) found.push(file);
    }
  }
  return found;
}

/** Returns the new args, or null when they already carry exactly this pin. */
function pinned(args, flag, binary) {
  const want = `${flag}${binary}`;
  if (args.includes(want)) return null;
  return [...args.filter((a) => !a.startsWith(flag)), want];
}

function pinAll({ home = os.homedir(), log = console.log } = {}) {
  const binary = newestTestBrowser(path.join(home, 'Library/Caches/ms-playwright'));
  if (!binary) {
    log('pin-test-browser: no Chrome for Testing found — run `npx playwright install chromium`');
    return { changed: [], binary: null };
  }
  const changed = [];
  for (const { plugin, manifest, servers, server, flag } of PLUGINS) {
    for (const file of manifests(path.join(home, '.claude/plugins/cache'), plugin, manifest)) {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      const entry = servers(doc)?.[server];
      if (!entry || !Array.isArray(entry.args)) {
        log(`pin-test-browser: ${file} has no ${server} server args — manifest shape changed?`);
        continue;
      }
      const next = pinned(entry.args, flag, binary);
      if (!next) continue;
      entry.args = next;
      fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
      changed.push(file);
    }
  }
  return { changed, binary };
}

if (require.main === module) {
  const hook = process.argv.includes('--hook');
  if (process.platform !== 'darwin') process.exit(0);
  const { changed } = pinAll({ log: hook ? (m) => console.error(m) : console.log });
  for (const file of changed) {
    console.log(`pin-test-browser: pinned ${file}${hook ? ' (applies next session)' : ''}`);
  }
  if (!hook && changed.length === 0) console.log('pin-test-browser: already pinned');
}

module.exports = { pinAll, pinned, newestTestBrowser };

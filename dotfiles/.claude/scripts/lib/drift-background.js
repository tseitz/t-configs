'use strict';

/**
 * The slow half of settings-drift: checks that need the network or take seconds. A SessionStart
 * hook cannot wait for them, so each is started detached and its result read by the NEXT session.
 * Every section therefore carries how old its data is.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const CACHE_DIR = path.join(os.homedir(), '.cache', 't-configs');
const INSTALL_CHECK_LOG = path.join(CACHE_DIR, 'install-check.log');
const FETCH_EVERY_MS = 60 * 60 * 1000;
const INSTALL_CHECK_EVERY_MS = 15 * 60 * 1000;
// A fetch older than this means the background fetch keeps failing, so "behind" can't be trusted.
const FETCH_STALE_MS = 24 * 60 * 60 * 1000;

function ageMs(file) {
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  return stat ? Date.now() - stat.mtimeMs : Infinity;
}

function formatAge(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

// Throttled on when a run was STARTED, not on its result: a hung or failing run never updates its
// result, so throttling on that would spawn another one every session.
function due(name, everyMs) {
  const marker = path.join(CACHE_DIR, `${name}.started`);
  if (ageMs(marker) < everyMs) return false;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(marker, '');
  return true;
}

function detached(command, args, cwd, env) {
  spawn(command, args, { cwd, detached: true, stdio: 'ignore', env: { ...process.env, ...env } }).unref();
}

// No optional locks: a session starting mid-commit must not trip over index.lock.
function git(repoDir, args) {
  return execFileSync('git', ['--no-optional-locks', '-C', repoDir, ...args], { encoding: 'utf8', timeout: 3000 }).trim();
}

/** Work this machine has that the other can't see, and work the other has that this one lacks. */
function repoSyncSections(repoDir) {
  const out = [];
  try {
    const fetchHead = path.join(git(repoDir, ['rev-parse', '--absolute-git-dir']), 'FETCH_HEAD');
    const fetchAge = ageMs(fetchHead);
    if (fetchAge > FETCH_EVERY_MS && due('fetch', FETCH_EVERY_MS)) {
      detached('git', ['-C', repoDir, 'fetch', '--quiet'], repoDir, {
        GIT_TERMINAL_PROMPT: '0',
        GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10',
      });
    }

    const dirty = git(repoDir, ['status', '--porcelain']).split('\n').filter(Boolean);
    if (dirty.length) {
      out.push({ title: `t-configs has ${dirty.length} uncommitted change(s) the other machine can't see`, items: [], fix: `git -C ${repoDir} status, then commit and push` });
    }

    const [behind, ahead] = git(repoDir, ['rev-list', '--left-right', '--count', '@{u}...HEAD']).split(/\s+/).map(Number);
    if (ahead) out.push({ title: `t-configs is ${ahead} commit(s) ahead of origin`, items: [], fix: `git -C ${repoDir} push` });
    if (behind) {
      out.push({ title: `t-configs is ${behind} commit(s) behind origin (as of fetch ${formatAge(fetchAge)} ago)`, items: [], fix: `git -C ${repoDir} pull && ${repoDir}/install.sh --sync` });
    }
    if (fetchAge > FETCH_STALE_MS && fetchAge !== Infinity) {
      out.push({ title: `t-configs last fetched ${formatAge(fetchAge)} ago; background fetch may be failing`, items: [], fix: `git -C ${repoDir} fetch` });
    }
  } catch (err) {
    out.push({ title: `t-configs git check failed: ${err.message.split('\n')[0]}`, items: [], fix: null });
  }
  return out;
}

// install.sh warns about these on every run by design; they are not drift.
const EXPECTED_WARNINGS = [/not in repo, skipped/];

function installCheckSections(repoDir) {
  try {
    return readInstallCheck(repoDir);
  } catch (err) {
    return [{ title: `install.sh --check cache failed: ${err.message}`, items: [], fix: null }];
  }
}

function readInstallCheck(repoDir) {
  const age = ageMs(INSTALL_CHECK_LOG);
  if (age > INSTALL_CHECK_EVERY_MS && due('install-check', INSTALL_CHECK_EVERY_MS)) {
    // Write then rename, so a reader never sees a half-finished run.
    const tmp = `${INSTALL_CHECK_LOG}.${process.pid}.tmp`;
    detached('bash', ['-c', './install.sh --check > "$1" 2>&1; mv "$1" "$2"', '_', tmp, INSTALL_CHECK_LOG], repoDir);
  }
  if (age === Infinity) return [];

  const warnings = fs
    .readFileSync(INSTALL_CHECK_LOG, 'utf8')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((line) => /^\[(warn|err)\]/.test(line))
    .filter((line) => !EXPECTED_WARNINGS.some((re) => re.test(line)))
    .map((line) => line.replace(/^\[(warn|err)\]\s*/, ''));
  if (!warnings.length) return [];
  return [{ title: `install.sh --check (${formatAge(age)} ago):\n      ${warnings.join('\n      ')}`, items: [], fix: `${repoDir}/install.sh --check for the full report` }];
}

module.exports = { repoSyncSections, installCheckSections };

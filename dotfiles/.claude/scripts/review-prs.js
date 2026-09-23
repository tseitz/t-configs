#!/usr/bin/env node
/**
 * Stages every PR I'm personally asked to review as a tab in the herdr
 * workspace "presentation-review": a detached worktree at
 * ~/code/worktrees/<repo>/pr-<n>, nvim in Diffview on the left, and Claude
 * on the right, connected to that nvim via --ide and running team-pr-review.
 *
 * Idempotent. A PR that already has a tab keeps it; if the PR has moved on,
 * its worktree is moved to the new head in place.
 *
 * Usage:
 *   review-prs.js [--dry-run] [--no-review] [--prune] [PR ...]
 *
 *   PR          stage these instead of searching, e.g. a team-requested PR:
 *               https://github.com/<owner>/<repo>/pull/<n> | <owner>/<repo>#<n> | <repo>#<n>
 *   --dry-run   print what would happen; change nothing
 *   --no-review start Claude idle instead of running team-pr-review
 *   --prune     first remove worktrees and tabs of closed or merged PRs
 *
 * Must run inside herdr, and outside the Claude Code sandbox (herdr socket,
 * ~/code/worktrees, gh keychain).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOME = os.homedir();
const PRESENTATION = path.join(HOME, 'Code', 'presentation');
const REPOS_JSON = path.join(PRESENTATION, 'repos.json');
const OTHER_CLONES = { 'alight-analytics/gaia': path.join(HOME, 'Code', 'gaia') };
const IDE_LOCK_DIR = path.join(HOME, '.claude', 'ide');
const WORKSPACE_LABEL = 'presentation-review';
const REVIEW_PROMPT = '/team-pr-review:team-pr-review';
const REVIEW_MODEL = 'opus';
// Case-insensitive: macOS resolves .Claude/ and MISE.toml to the real names.
const MISE_CONFIG = /(^|\/)(\.?mise(\.local)?\.toml|\.config\/mise(\.local)?\.toml|\.?config\/mise\/config(\.local)?\.toml|\.?mise\/config(\.local)?\.toml)$/i;
// mise config can load .env files (`_.file`), so an unchanged mise.toml still runs a PR-edited one.
const MISE_SENSITIVE = [MISE_CONFIG, /(^|\/)\.env[^/]*$/i];
const CLAUDE_CONFIG = [/(^|\/)\.claude(\/|$)/i, /(^|\/)\.mcp\.json$/i, /(^|\/)CLAUDE(\.local)?\.md$/i];
// Paranoid mode ties mise trust to file content and stops a linked worktree
// inheriting the main clone's trust — without it a PR's own mise.toml edits
// load in every pane of the tab. HERDR_REVIEW turns off nvim language servers
// that run project JS (personal.lua).
const PANE_ENV = ['--env', 'MISE_PARANOID=1', '--env', 'HERDR_REVIEW=1'];
// A repo-relative core.hooksPath (husky's .husky/_) resolves inside the PR's tree.
const NO_HOOKS = ['-c', 'core.hooksPath=/dev/null'];

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function errorText(err) {
  return String((err.stderr && err.stderr.toString().trim()) || err.message).split('\n')[0];
}

function tryRun(cmd, args, opts) {
  try {
    return { ok: true, out: run(cmd, args, opts) };
  } catch (err) {
    return { ok: false, err: errorText(err) };
  }
}

function runJson(cmd, args, opts) {
  const out = run(cmd, args, opts);
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`${cmd} ${args.slice(0, 2).join(' ')}: unparseable output: ${out.slice(0, 200)}`);
  }
}

function herdr(...args) {
  const response = runJson('herdr', args);
  if (response.error) throw new Error(`herdr ${args.slice(0, 2).join(' ')}: ${JSON.stringify(response.error)}`);
  return response.result;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// macOS is case-insensitive: ~/code is really ~/Code, and nvim's getcwd() and
// herdr's pane cwd report the on-disk case. realpathSync keeps the case it was
// given, so only .native makes the path comparisons below match.
function canonical(p) {
  const tail = [];
  let head = p;
  while (!fs.existsSync(head)) {
    tail.unshift(path.basename(head));
    head = path.dirname(head);
  }
  return path.join(fs.realpathSync.native(head), ...tail);
}

const ROOT = canonical(path.join(HOME, 'code', 'worktrees'));

function within(p, dir) {
  return p === dir || p.startsWith(dir + '/');
}

function parseArgs(argv) {
  const opts = { dryRun: false, review: true, prune: false, targets: [] };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-review') opts.review = false;
    else if (arg === '--prune') opts.prune = true;
    else if (arg === '-h' || arg === '--help') {
      console.log('Usage: review-prs.js [--dry-run] [--no-review] [--prune] [PR ...]');
      process.exit(0);
    } else if (arg.startsWith('-')) throw new Error(`unknown flag ${arg}`);
    else opts.targets.push(arg);
  }
  return opts;
}

function loadRoster() {
  return JSON.parse(fs.readFileSync(REPOS_JSON, 'utf8')).repos;
}

function parseTarget(target, roster) {
  let m = target.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/) || target.match(/^([^/#\s]+)\/([^/#\s]+)#(\d+)$/);
  if (m) return { owner: m[1], repo: m[2], number: Number(m[3]) };
  m = target.match(/^([^/#\s]+)#(\d+)$/);
  if (m) {
    const entry = roster.find(r => r.name.toLowerCase() === m[1].toLowerCase());
    if (!entry) throw new Error(`${target}: ${m[1]} is not in repos.json — use <owner>/<repo>#<n>`);
    return { owner: entry.org, repo: entry.name, number: Number(m[2]) };
  }
  throw new Error(`can't parse PR "${target}"`);
}

function findRequested() {
  const me = run('gh', ['api', 'user', '--jq', '.login']);
  const hits = runJson('gh', [
    'search', 'prs', '--review-requested=@me', '--state=open', '--limit', '100', '--json', 'repository,number',
  ]);
  const prs = [];
  let teamOnly = 0;
  for (const hit of hits) {
    const [owner, repo] = hit.repository.nameWithOwner.split('/');
    // --review-requested=@me also matches requests to any team I'm on.
    const users = run('gh', ['api', `repos/${owner}/${repo}/pulls/${hit.number}/requested_reviewers`, '--jq', '.users[].login']);
    if (users.split('\n').includes(me)) prs.push({ owner, repo, number: hit.number });
    else teamOnly++;
  }
  return { prs, teamOnly };
}

function resolveClone(pr, roster) {
  const other = OTHER_CLONES[`${pr.owner}/${pr.repo}`];
  if (other) return { clone: other, work: false };
  const entry = roster.find(r => r.name === pr.repo && r.org === pr.owner);
  return entry ? { clone: path.join(PRESENTATION, entry.name), work: true } : null;
}

function registeredWorktrees(clone) {
  return run('git', ['-C', clone, 'worktree', 'list', '--porcelain'])
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => canonical(line.slice('worktree '.length)));
}

function isDirty(wt) {
  return run('git', ['-C', wt, 'status', '--porcelain']) !== '';
}

// `worktree remove` deletes gitignored files too, e.g. notes in .claude/plans/. Rebuildable dirs don't count.
function ignoredWork(wt) {
  return run('git', ['-C', wt, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])
    .split('\n')
    .filter(Boolean)
    .filter(f => !/(^|\/)(node_modules|\.bundle|vendor|tmp|log|coverage|dist|build|\.next|\.turbo)\/$/.test(f));
}

function loadHerdr(dryRun) {
  const workspace = herdr('workspace', 'list').workspaces.find(w => w.label === WORKSPACE_LABEL);
  if (!workspace) return { workspaceId: null, tabs: [], panes: [], dryRun };
  const id = workspace.workspace_id;
  return {
    workspaceId: id,
    tabs: herdr('tab', 'list', '--workspace', id).tabs,
    panes: herdr('pane', 'list', '--workspace', id).panes,
    dryRun,
  };
}

function ensureWorkspace(ctx) {
  if (ctx.workspaceId) return ctx.workspaceId;
  fs.mkdirSync(ROOT, { recursive: true });
  ctx.workspaceId = herdr('workspace', 'create', '--label', WORKSPACE_LABEL, '--cwd', ROOT, '--no-focus').workspace.workspace_id;
  return ctx.workspaceId;
}

// cwd survives a tab rename; the label survives both shells cd-ing away. A cwd match
// counts only beside an agent pane: a bare shell left in the worktree isn't the review tab.
function findTab(ctx, wt, label) {
  const hasAgent = tabId => ctx.panes.some(p => p.tab_id === tabId && p.agent);
  const pane = ctx.panes.find(p => [p.cwd, p.foreground_cwd].some(c => c && within(c, wt)) && hasAgent(p.tab_id));
  if (pane) return pane.tab_id;
  const tab = ctx.tabs.find(t => t.label === label);
  return tab ? tab.tab_id : null;
}

function tabIsWorking(ctx, tabId) {
  return ctx.panes.some(p => p.tab_id === tabId && p.agent_status === 'working');
}

function agentName(repo, number) {
  return `${repo}-${number}`.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
}

function matchesAny(file, patterns) {
  return patterns.some(re => re.test(file));
}

// -z: without it git quotes non-ASCII paths (".claude/\303\251.json"), which slips past ^ in the gates.
// Symlinks are returned too: one can point a harmless-looking path (.claude, mise.toml) at a
// file the name gates never see.
function changedFiles(wt, gateBase) {
  const fields = run('git', ['-C', wt, 'diff', '--raw', '-z', '--no-renames', gateBase, 'HEAD']).split('\0');
  const files = [];
  const symlinks = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [, newMode] = fields[i].split(' ');
    files.push(fields[i + 1]);
    if (newMode === '120000') symlinks.push(fields[i + 1]);
  }
  return { files, symlinks };
}

function gateMise(wt, sensitiveChanged) {
  const configs = run('git', ['-C', wt, 'ls-files']).split('\n').filter(f => MISE_CONFIG.test(f));
  for (const file of configs) {
    const target = path.join(wt, file);
    // --ignore also beats the trust a normal-mode shell would inherit from the main clone.
    if (sensitiveChanged) run('mise', ['trust', '--ignore', '--quiet', target]);
    else run('mise', ['trust', '--quiet', target], { env: { ...process.env, MISE_PARANOID: '1' } });
  }
}

function trunkOf(pr, roster) {
  const entry = roster.find(r => r.name === pr.repo && r.org === pr.owner);
  if (entry && entry.baseBranch) return entry.baseBranch;
  return run('gh', ['repo', 'view', `${pr.owner}/${pr.repo}`, '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name']);
}

function waitForIdeLock(wt, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(IDE_LOCK_DIR) ? fs.readdirSync(IDE_LOCK_DIR).filter(f => f.endsWith('.lock')) : [];
    for (const file of files) {
      let lock;
      try {
        lock = JSON.parse(fs.readFileSync(path.join(IDE_LOCK_DIR, file), 'utf8'));
      } catch {
        continue; // a lock file mid-write, or one from another IDE's format
      }
      if ((lock.workspaceFolders || []).some(folder => within(wt, folder))) return true;
    }
    sleep(500);
  }
  return false;
}

// agent start needs the pane at its shell prompt; a fresh pane's zsh may still be loading.
function startAgent(name, pane, args) {
  const deadline = Date.now() + 15000;
  for (;;) {
    const attempt = tryRun('herdr', ['agent', 'start', name, '--kind', 'claude', '--pane', pane, '--', ...args]);
    if (attempt.ok) return;
    if (Date.now() > deadline) throw new Error(`claude didn't start: ${attempt.err}`);
    sleep(1000);
  }
}

function openTab(ctx, s, opts) {
  const workspaceId = ensureWorkspace(ctx);
  const env = [...PANE_ENV, ...(s.work ? ['--env', 'T_WORK_FORCE=1'] : [])];
  const tab = herdr('tab', 'create', '--workspace', workspaceId, '--cwd', s.wt, '--label', s.label, ...env, '--no-focus');
  const nvimPane = tab.root_pane.pane_id;
  run('herdr', ['pane', 'run', nvimPane, `nvim '+DiffviewOpen ${s.mergeBase}'`]);

  if (s.claudeFiles.length) {
    s.notes.push(`PR changes ${s.claudeFiles.join(', ')} — Claude not started; read those before you start it`);
    return;
  }

  const claudePane = herdr(
    'pane', 'split', nvimPane, '--direction', 'right', '--ratio', '0.6', '--cwd', s.wt,
    ...env, '--env', 'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1', '--no-focus',
  ).pane.pane_id;

  if (!waitForIdeLock(s.wt, 20000)) s.notes.push('nvim IDE server not seen — run /ide in the Claude pane');

  const name = agentName(s.pr.repo, s.pr.number);
  startAgent(name, claudePane, ['--ide', '--model', REVIEW_MODEL, '-n', s.label, ...(s.work ? ['--add-dir', PRESENTATION] : [])]);

  if (opts.review) {
    const started = tryRun('herdr', ['agent', 'prompt', name, REVIEW_PROMPT, '--wait', '--until', 'working', '--timeout', '15000']);
    s.notes.push(started.ok ? 'team-pr-review running' : `team-pr-review not confirmed started: ${started.err}`);
  }
}

function syncPr(pr, ctx, roster, opts) {
  const s = { pr, label: `${pr.repo}#${pr.number}`, notes: [], title: '', url: '' };
  const resolved = resolveClone(pr, roster);
  if (!resolved) return { ...s, status: 'skipped', why: `no known local clone for ${pr.owner}/${pr.repo}` };
  Object.assign(s, resolved, { wt: path.join(ROOT, pr.repo, `pr-${pr.number}`) });

  const view = runJson('gh', [
    'pr', 'view', String(pr.number), '-R', `${pr.owner}/${pr.repo}`, '--json', 'baseRefName,headRefOid,state,title,url',
  ]);
  Object.assign(s, { title: view.title, url: view.url });
  if (view.state !== 'OPEN') return { ...s, status: 'skipped', why: `PR is ${view.state.toLowerCase()}` };

  const registered = registeredWorktrees(s.clone).includes(s.wt);
  if (fs.existsSync(s.wt) && !registered) return { ...s, status: 'skipped', why: `${s.wt} exists but isn't a worktree of ${s.clone}` };
  const tabId = findTab(ctx, s.wt, s.label);
  const head = registered ? run('git', ['-C', s.wt, 'rev-parse', 'HEAD']) : null;

  let status;
  let why = '';
  if (!registered) status = 'created';
  else if (head === view.headRefOid) status = 'unchanged';
  else if (tabId && tabIsWorking(ctx, tabId)) [status, why] = ['kept', 'Claude is working in its tab — worktree not moved'];
  else if (isDirty(s.wt)) [status, why] = ['kept', 'worktree has local changes — not moved'];
  else [status, why] = ['updated', `${head.slice(0, 7)} → ${view.headRefOid.slice(0, 7)}`];

  if (opts.dryRun) {
    return { ...s, status, why: [why, tabId ? 'has tab' : 'would open tab'].filter(Boolean).join('; ') };
  }

  const trunk = trunkOf(pr, roster);
  // pull/<n>/head rather than the head branch, so fork PRs work too.
  run('git', ['-C', s.clone, 'fetch', '--quiet', 'origin', `pull/${pr.number}/head`, view.baseRefName, trunk]);
  if (status === 'created') {
    fs.mkdirSync(path.dirname(s.wt), { recursive: true });
    run('git', [...NO_HOOKS, '-C', s.clone, 'worktree', 'add', '--quiet', '--detach', s.wt, view.headRefOid]);
  } else if (status === 'updated') {
    run('git', [...NO_HOOKS, '-C', s.wt, 'checkout', '--quiet', '--detach', view.headRefOid]);
  }

  // Diffview shows the PR against its own base (a stacked PR's parent), but the
  // gates compare against trunk, so a child can't inherit its parent's unreviewed config.
  s.mergeBase = run('git', ['-C', s.wt, 'merge-base', `origin/${view.baseRefName}`, 'HEAD']);
  const gateBase = run('git', ['-C', s.wt, 'merge-base', `origin/${trunk}`, 'HEAD']);
  const { files, symlinks } = changedFiles(s.wt, gateBase);
  const miseFiles = files.filter(f => matchesAny(f, MISE_SENSITIVE));
  s.claudeFiles = [...files.filter(f => matchesAny(f, CLAUDE_CONFIG)), ...symlinks.map(f => `${f} (symlink)`)];
  gateMise(s.wt, miseFiles.length > 0 || symlinks.length > 0);
  if (miseFiles.length || symlinks.length) {
    s.notes.push(`PR changes ${[...miseFiles, ...symlinks].join(', ')} — mise config ignored in this worktree`);
  }

  if (tabId) {
    if (status === 'updated') s.notes.push('worktree moved under an open tab — :DiffviewRefresh in nvim, re-run the review');
    if (s.claudeFiles.length) {
      s.notes.push(`PR changes ${s.claudeFiles.join(', ')} — read those before (re)starting Claude in this tab`);
    }
  } else {
    openTab(ctx, s, opts);
    s.notes.push(`opened tab ${s.label}`);
  }
  return { ...s, status, why };
}

function prune(ctx, dryRun) {
  const results = [];
  if (!fs.existsSync(ROOT)) return results;
  for (const repoDir of fs.readdirSync(ROOT)) {
    const repoPath = path.join(ROOT, repoDir);
    if (!fs.statSync(repoPath).isDirectory()) continue;
    for (const dir of fs.readdirSync(repoPath)) {
      const m = dir.match(/^pr-(\d+)$/);
      const wt = path.join(repoPath, dir);
      if (!m || !fs.existsSync(path.join(wt, '.git'))) continue;
      if (tryRun('git', ['-C', wt, 'symbolic-ref', '--quiet', 'HEAD']).ok) continue; // on a branch: not ours
      const label = `${repoDir}#${m[1]}`;
      try {
        const state = run('gh', ['pr', 'view', m[1], '--json', 'state', '--jq', '.state'], { cwd: wt });
        if (state === 'OPEN') continue;
        const ignored = ignoredWork(wt);
        if (isDirty(wt) || ignored.length) {
          const extra = ignored.length ? ` (ignored: ${ignored.slice(0, 3).join(', ')})` : '';
          results.push({ label, status: 'kept', why: `PR ${state.toLowerCase()} but worktree has local changes${extra}` });
          continue;
        }
        if (!dryRun) {
          const tabId = findTab(ctx, wt, label);
          if (tabId) run('herdr', ['tab', 'close', tabId]);
          const clone = path.dirname(run('git', ['-C', wt, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
          run('git', ['-C', clone, 'worktree', 'remove', wt]);
        }
        results.push({ label, status: dryRun ? 'would prune' : 'pruned', why: `PR ${state.toLowerCase()}` });
      } catch (err) {
        results.push({ label, status: 'failed', why: errorText(err) });
      }
    }
  }
  return results;
}

function printLine(r) {
  const head = `  ${r.status.padEnd(11)} ${r.label}`;
  console.log([head, r.title, r.why && `(${r.why})`].filter(Boolean).join('  '));
  if (r.url) console.log(`              ${r.url}`);
  for (const note of r.notes || []) console.log(`              - ${note}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.HERDR_SOCKET_PATH) throw new Error('not inside herdr (HERDR_SOCKET_PATH unset)');
  const roster = loadRoster();
  const ctx = loadHerdr(opts.dryRun);
  let failed = 0;

  if (opts.prune) {
    const pruned = prune(ctx, opts.dryRun);
    console.log(pruned.length ? 'Prune:' : 'Prune: nothing to prune');
    pruned.forEach(printLine);
    if (!opts.dryRun && pruned.some(r => r.status === 'pruned')) Object.assign(ctx, loadHerdr(opts.dryRun));
  }

  const { prs, teamOnly } = opts.targets.length
    ? { prs: opts.targets.map(t => parseTarget(t, roster)), teamOnly: 0 }
    : findRequested();

  const summary = opts.targets.length
    ? `${prs.length} PR(s) given`
    : `${prs.length} PR(s) requested from you by name${teamOnly ? `, ${teamOnly} team-only request(s) ignored` : ''}`;
  console.log(`${WORKSPACE_LABEL}${opts.dryRun ? ' (dry run)' : ''}: ${summary}`);

  for (const pr of prs) {
    let result;
    try {
      result = syncPr(pr, ctx, roster, opts);
    } catch (err) {
      failed++;
      result = { label: `${pr.repo}#${pr.number}`, status: 'failed', why: err.message.split('\n')[0] };
    }
    printLine(result);
  }
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`review-prs: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { changedFiles, matchesAny, within, MISE_SENSITIVE, CLAUDE_CONFIG, NO_HOOKS };

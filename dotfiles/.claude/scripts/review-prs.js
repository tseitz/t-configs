#!/usr/bin/env node
/**
 * Stages every PR I'm personally asked to review as a tab in the herdr
 * workspace "presentation-review", labelled "<repo>#<n> <JIRA-KEY>": a detached
 * worktree at ~/code/worktrees/<repo>/pr-<n> with env files copied and deps
 * installed scripts-off (worktree-bootstrap.sh --untrusted), nvim in Diffview on
 * the left, and Claude on the right, connected to that nvim via --ide and running
 * team-pr-review.
 *
 * Idempotent. A PR that already has a tab keeps it; if the PR has moved on,
 * its worktree is moved to the new head in place.
 *
 * A search run then reorders the tabs: the first tab stays put, requested
 * PRs follow longest-waiting first, and every other tab goes after them.
 *
 * Usage:
 *   review-prs.js [--dry-run] [--no-review] [--prune] [PR ...]
 *
 *   PR          stage these instead of searching, e.g. a team-requested PR:
 *               https://github.com/<owner>/<repo>/pull/<n> | <owner>/<repo>#<n> | <repo>#<n>
 *   --dry-run   print what would happen; change nothing
 *   --no-review start Claude idle instead of running team-pr-review
 *   --prune     first remove worktrees and tabs of closed or merged PRs;
 *               merged ones go even with local changes, closed ones are kept
 *
 * Must run inside herdr, and outside the Claude Code sandbox (herdr socket,
 * ~/code/worktrees, gh keychain).
 */

const fs = require('fs');
const net = require('net');
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
// mise.lock carries the download URL for each tool.
const MISE_SENSITIVE = [MISE_CONFIG, /(^|\/)\.env[^/]*$/i, /(^|\/)\.?mise(\.local)?\.lock$/i];
const CLAUDE_CONFIG = [/(^|\/)\.claude(\/|$)/i, /(^|\/)\.mcp\.json$/i, /(^|\/)CLAUDE(\.local)?\.md$/i];
// Each lets a PR choose what an install runs or where it fetches from; any change skips the install.
const PM_CONFIG = [
  /(^|\/)\.npmrc$/i, /(^|\/)\.yarnrc(\.yml)?$/i, /(^|\/)\.yarn\//i, /(^|\/)\.pnpmfile\.[cm]?js$/i,
  /(^|\/)pnpm-workspace\.yaml$/i, /(^|\/)\.corepack\.env$/i,
];
// Root package.json fields that pick the package-manager binary or pull in a pnpmfile.
const PM_FIELDS = ['packageManager', 'devEngines', 'pnpm'];
const LOCKFILES = /^(pnpm-lock\.yaml|yarn\.lock|package-lock\.json|npm-shrinkwrap\.json|bun\.lockb?)$/i;
const BOOTSTRAP = path.join(__dirname, 'worktree-bootstrap.sh');
// The whole run shares one Bash timeout (review-assigned-prs.md), so one hung install can't eat it.
const INSTALL_TIMEOUT_MS = 180000;
// Paranoid mode ties mise trust to file content and stops a linked worktree
// inheriting the main clone's trust — without it a PR's own mise.toml edits
// load in every pane of the tab. HERDR_REVIEW turns off nvim language servers
// that run project JS (personal.lua).
const PANE_ENV = ['--env', 'MISE_PARANOID=1', '--env', 'HERDR_REVIEW=1'];
// A repo-relative core.hooksPath (husky's .husky/_) resolves inside the PR's tree.
const NO_HOOKS = ['-c', 'core.hooksPath=/dev/null'];
const REVIEW_REQUESTS_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewRequests(first: 100) { nodes { requestedReviewer { ... on User { login } } } }
      timelineItems(itemTypes: [REVIEW_REQUESTED_EVENT], last: 100) {
        nodes { ... on ReviewRequestedEvent { createdAt requestedReviewer { ... on User { login } } } }
      }
    }
  }
}`;

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

// For socket methods the CLI doesn't wrap, e.g. tab.move.
function herdrSocket(method, params) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(process.env.HERDR_SOCKET_PATH);
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify({ id: method, method, params })}\n`));
    socket.on('data', chunk => {
      buffer += chunk;
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      socket.destroy();
      try {
        const response = JSON.parse(buffer.slice(0, end));
        if (response.error) reject(new Error(`herdr ${method}: ${JSON.stringify(response.error)}`));
        else resolve(response.result);
      } catch {
        reject(new Error(`herdr ${method}: unparseable response: ${buffer.slice(0, 200)}`));
      }
    });
    socket.on('error', reject);
    socket.on('close', () => reject(new Error(`herdr ${method}: socket closed without a response`)));
  });
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
    'search', 'prs', '--review-requested=@me', '--state=open', '--limit', '100', '--json', 'repository,number,updatedAt',
  ]);
  const prs = [];
  let teamOnly = 0;
  for (const hit of hits) {
    const [owner, repo] = hit.repository.nameWithOwner.split('/');
    const pull = runJson('gh', [
      'api', 'graphql', '-f', `query=${REVIEW_REQUESTS_QUERY}`, '-f', `owner=${owner}`, '-f', `repo=${repo}`, '-F', `number=${hit.number}`,
    ]).data.repository.pullRequest;
    const byMe = node => node.requestedReviewer && node.requestedReviewer.login === me;
    // --review-requested=@me also matches requests to any team I'm on.
    if (!pull.reviewRequests.nodes.some(byMe)) {
      teamOnly++;
      continue;
    }
    // Request time, not updatedAt: an author push or a comment bumps that without the PR waiting on me any less.
    const asks = pull.timelineItems.nodes.filter(byMe);
    const waitingSince = asks.length ? asks[asks.length - 1].createdAt : hit.updatedAt;
    prs.push({ owner, repo, number: hit.number, waitingSince });
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

// `worktree remove` deletes gitignored files too, e.g. notes in .claude/plans/. Rebuildable dirs,
// tool scratch space and untouched copies of the main clone's files (bootstrap's env copy) don't count.
function ignoredWork(wt, clone) {
  return run('git', ['-C', wt, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])
    .split('\n')
    .filter(Boolean)
    .filter(f => !/(^|\/)(node_modules|\.bundle|vendor|tmp|log|coverage|dist|build|\.next|\.turbo)\/$/.test(f))
    .filter(f => !/^(\.yarn|\.pnpm-store|\.claude\/\.cc-writes)\//.test(f))
    .filter(f => !sameAsClone(wt, clone, f));
}

function sameAsClone(wt, clone, file) {
  const theirs = path.join(clone, file);
  if (file.endsWith('/') || !fs.existsSync(theirs) || !fs.statSync(theirs).isFile()) return false;
  return fs.readFileSync(path.join(wt, file)).equals(fs.readFileSync(theirs));
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
// `base` is labelOf(pr): the Jira key after it comes and goes with the PR title.
function findTab(ctx, wt, base) {
  const hasAgent = tabId => ctx.panes.some(p => p.tab_id === tabId && p.agent);
  const pane = ctx.panes.find(p => [p.cwd, p.foreground_cwd].some(c => c && within(c, wt)) && hasAgent(p.tab_id));
  if (pane) return pane.tab_id;
  const tab = ctx.tabs.find(t => t.label === base || t.label.startsWith(`${base} `));
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

// null when an install is safe to attempt, else why not.
function installGate(wt, gateBase, files, symlinks) {
  if (symlinks.length) return `PR adds symlinks (${symlinks.join(', ')})`;
  const config = files.filter(f => matchesAny(f, PM_CONFIG));
  if (config.length) return `PR changes ${config.join(', ')}`;
  // mise config can load an env file into the install (NODE_OPTIONS=--require …).
  const mise = files.filter(f => matchesAny(f, MISE_SENSITIVE));
  if (mise.length) return `PR changes ${mise.join(', ')}`;
  // pnpm 10 applies patches even with --ignore-scripts, and doesn't keep their paths inside the package.
  const patches = files.filter(f => /\.(patch|diff)$/i.test(f) || /(^|\/)patches\//i.test(f));
  if (patches.length) return `PR changes patch files (${patches.join(', ')})`;
  // Non-registry resolutions make the install connect wherever the PR says.
  const added = run('git', ['-C', wt, 'diff', '-U0', gateBase, 'HEAD', '--', 'pnpm-lock.yaml'])
    .split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'));
  const remote = added.find(l => /\b(tarball|repo|directory):|type: git|http:\/\//.test(l));
  if (remote) return `PR adds a non-registry resolution to pnpm-lock.yaml (${remote.slice(1).trim()})`;

  const locksAt = rev => run('git', ['-C', wt, 'ls-tree', '--name-only', rev]).split('\n').filter(f => LOCKFILES.test(f)).sort().join(', ');
  const baseLocks = locksAt(gateBase);
  if (baseLocks !== locksAt('HEAD')) return `PR changes which lockfiles exist (${baseLocks || 'none'} → ${locksAt('HEAD') || 'none'})`;

  const manifestAt = rev => {
    const shown = tryRun('git', ['-C', wt, 'show', `${rev}:package.json`]);
    if (!shown.ok) return {};
    try {
      return JSON.parse(shown.out);
    } catch {
      return null;
    }
  };
  const [base, head] = [manifestAt(gateBase), manifestAt('HEAD')];
  if (!base || !head) return 'package.json does not parse';
  const moved = PM_FIELDS.filter(k => JSON.stringify(base[k]) !== JSON.stringify(head[k]));
  if (moved.length) return `PR changes package.json ${moved.join(', ')}`;
  const patched = Object.values((base.pnpm && base.pnpm.patchedDependencies) || {})
    .map(p => path.posix.normalize(p))
    .filter(p => files.includes(p));
  if (patched.length) return `PR changes patch files (${patched.join(', ')})`;

  // yarn berry runs exec: and git dependencies while fetching, which skip-build doesn't stop.
  if (/yarn\.lock/i.test(baseLocks)) {
    const deps = files.filter(f => /(^|\/)(package\.json|yarn\.lock)$/i.test(f));
    if (deps.length) return `yarn repo and PR changes ${deps.join(', ')}`;
  }
  return null;
}

function lastLine(file) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n') : [];
  return lines.length && lines[lines.length - 1] ? lines[lines.length - 1] : 'no output';
}

// What an install may find besides the PR's commits. Anything else — a tracked edit, a planted
// .npmrc — may be what sandboxed code (a PR test run in the tab) left for this unsandboxed install.
const INSTALL_LEFTOVERS = /^((.*\/)?node_modules\/|\.claude\/\.cc-writes\/|\.yarn\/.*|(.*\/)?\.DS_Store|(tmp|log|coverage|dist|build|\.next|\.turbo)\/)$/;

function unexpectedFiles(wt, clone) {
  const changed = run('git', ['-C', wt, 'status', '--porcelain']).split('\n').filter(Boolean).map(l => l.slice(3));
  const ignored = run('git', ['-C', wt, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory'])
    .split('\n')
    .filter(Boolean)
    .filter(f => !INSTALL_LEFTOVERS.test(f) && !sameAsClone(wt, clone, f));
  return [...changed, ...ignored];
}

function bootstrapWorktree(s, ctx, tabId, gateBase, files, symlinks) {
  // The env copy would follow a committed symlink.
  if (symlinks.length) {
    s.notes.push(`deps: not installed, env not copied — PR adds symlinks (${symlinks.join(', ')})`);
    return;
  }
  if (tabId && tabIsWorking(ctx, tabId)) {
    s.notes.push('deps: not installed — Claude is working in its tab');
    return;
  }

  const gitDir = run('git', ['-C', s.wt, 'rev-parse', '--absolute-git-dir']);
  const log = path.join(gitDir, 'review-bootstrap.log');
  const done = path.join(gitDir, 'review-bootstrap.head');
  const head = run('git', ['-C', s.wt, 'rev-parse', 'HEAD']);
  const has = file => fs.existsSync(path.join(s.wt, file));
  if (has('node_modules') && fs.existsSync(done) && fs.readFileSync(done, 'utf8').trim() === head) {
    s.notes.push('deps: installed earlier for this head');
    return;
  }

  const unexpected = has('package.json') ? unexpectedFiles(s.wt, s.clone) : [];
  const gated = unexpected.length
    ? `worktree has files bootstrap didn't write (${unexpected.slice(0, 3).join(', ')}${unexpected.length > 3 ? ', …' : ''})`
    : has('package.json') && installGate(s.wt, gateBase, files, symlinks);
  const install = !gated && has('package.json');
  const hadModules = has('node_modules');
  const opts = { cwd: s.wt, env: { ...process.env, MISE_PARANOID: '1' }, timeout: INSTALL_TIMEOUT_MS };

  fs.rmSync(log, { force: true });
  if (install) process.stderr.write(`  installing  ${s.label}…\n`);
  const started = Date.now();
  const result = tryRun(BOOTSTRAP, [install ? '--untrusted' : '--skip-install', '--log', log], opts);

  if (!result.ok) {
    const why = /ETIMEDOUT/.test(result.err) ? `timed out after ${INSTALL_TIMEOUT_MS / 1000}s` : fs.existsSync(log) ? lastLine(log) : result.err;
    s.notes.push(`deps: bootstrap failed — ${why}; log ${log}${gated ? ` (install skipped anyway: ${gated})` : ''}`);
  } else if (gated) {
    s.notes.push(`deps: not installed — ${gated}`);
  } else if (!install) {
    s.notes.push('deps: no package.json — env files copied, nothing installed');
  } else {
    fs.writeFileSync(done, `${head}\n`);
    const pm = has('pnpm-lock.yaml') ? 'pnpm' : 'yarn';
    s.notes.push(`deps: ${pm}, scripts off, ${Math.round((Date.now() - started) / 1000)}s`);
    if (tabId && !hadModules) s.notes.push('deps installed under an open nvim — :LspRestart');
  }

  // A tracked file rewritten here would turn every later update of this PR into `kept`.
  const dirty = run('git', ['-C', s.wt, 'status', '--porcelain']);
  if (dirty) s.notes.push(`bootstrap left changes: ${dirty.split('\n').map(l => l.slice(3)).join(', ')}`);
}

// Title scope first ("feat(MF-6830): …"). Branch fallback wants 2+ digits so "utf-8" isn't a ticket.
function jiraKey(title, branch) {
  const inTitle = title.match(/^\w+\(([A-Z][A-Z0-9]+-\d+)\)/) || title.match(/^\[?([A-Z][A-Z0-9]+-\d+)\b/);
  if (inTitle) return inTitle[1];
  const inBranch = branch.match(/(?:^|[/_-])([a-z][a-z0-9]+-\d{2,})(?=$|[/_-])/i);
  return inBranch ? inBranch[1].toUpperCase() : null;
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

function labelOf(pr) {
  return `${pr.repo}#${pr.number}`;
}

function worktreeOf(pr) {
  return path.join(ROOT, pr.repo, `pr-${pr.number}`);
}

function syncPr(pr, ctx, roster, opts) {
  const s = { pr, base: labelOf(pr), label: labelOf(pr), notes: [], title: '', url: '' };
  const resolved = resolveClone(pr, roster);
  if (!resolved) return { ...s, status: 'skipped', why: `no known local clone for ${pr.owner}/${pr.repo}` };
  Object.assign(s, resolved, { wt: worktreeOf(pr) });

  const view = runJson('gh', [
    'pr', 'view', String(pr.number), '-R', `${pr.owner}/${pr.repo}`, '--json', 'baseRefName,headRefName,headRefOid,state,title,url',
  ]);
  const key = jiraKey(view.title, view.headRefName);
  Object.assign(s, { title: view.title, url: view.url, label: key ? `${s.base} ${key}` : s.base });
  if (view.state !== 'OPEN') return { ...s, status: 'skipped', why: `PR is ${view.state.toLowerCase()}` };

  const registered = registeredWorktrees(s.clone).includes(s.wt);
  if (fs.existsSync(s.wt) && !registered) return { ...s, status: 'skipped', why: `${s.wt} exists but isn't a worktree of ${s.clone}` };
  const tabId = findTab(ctx, s.wt, s.base);
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
  if (status !== 'kept') bootstrapWorktree(s, ctx, tabId, gateBase, files, symlinks);

  if (tabId) {
    // Only a label this script wrote; anything else is a rename of mine.
    const tab = ctx.tabs.find(t => t.tab_id === tabId);
    if (tab && tab.label === s.base && s.label !== s.base) {
      const renamed = tryRun('herdr', ['tab', 'rename', tabId, s.label]);
      if (!renamed.ok) s.notes.push(`tab not renamed to ${s.label}: ${renamed.err}`);
    }
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
        const merged = state === 'MERGED';
        const clone = path.dirname(run('git', ['-C', wt, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
        const ignored = ignoredWork(wt, clone);
        const hasLocal = isDirty(wt) || ignored.length > 0;
        if (hasLocal && !merged) {
          const extra = ignored.length ? ` (ignored: ${ignored.slice(0, 3).join(', ')})` : '';
          results.push({ label, status: 'kept', why: `PR ${state.toLowerCase()} but worktree has local changes${extra}` });
          continue;
        }
        if (!dryRun) {
          const tabId = findTab(ctx, wt, label);
          if (tabId) run('herdr', ['tab', 'close', tabId]);
          run('git', ['-C', clone, 'worktree', 'remove', ...(hasLocal ? ['--force'] : []), wt]);
        }
        const discarded = hasLocal ? ', local changes discarded' : '';
        results.push({ label, status: dryRun ? 'would prune' : 'pruned', why: `PR ${state.toLowerCase()}${discarded}` });
      } catch (err) {
        results.push({ label, status: 'failed', why: errorText(err) });
      }
    }
  }
  return results;
}

async function orderTabs(ctx, prs, dryRun) {
  const waiting = prs
    .map(pr => ({ label: labelOf(pr), since: pr.waitingSince, tabId: findTab(ctx, worktreeOf(pr), labelOf(pr)) }))
    .filter(t => t.tabId)
    .sort((a, b) => a.since.localeCompare(b.since));
  const waitingIds = new Set(waiting.map(t => t.tabId));
  let order = ctx.tabs.map(t => t.tab_id);
  const lead = order.length && !waitingIds.has(order[0]) ? [order[0]] : [];
  const rest = order.filter(id => !lead.includes(id) && !waitingIds.has(id));
  const desired = [...lead, ...waiting.map(t => t.tabId), ...rest];
  if (desired.every((id, i) => id === order[i])) return null;

  if (!dryRun) {
    for (const [i, tabId] of desired.entries()) {
      if (order[i] === tabId) continue;
      order = (await herdrSocket('tab.move', { tab_id: tabId, insert_index: i })).tabs.map(t => t.tab_id);
    }
  }
  return waiting.map(t => `${t.label} ${t.since.slice(0, 10)}`).join(', ');
}

// Titles, paths and log lines are PR-controlled, and a Claude relays this report.
function printable(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f]/g, '?').slice(0, 300);
}

function printLine(r) {
  const head = `  ${r.status.padEnd(11)} ${printable(r.label)}`;
  console.log([head, r.title && printable(r.title), r.why && `(${printable(r.why)})`].filter(Boolean).join('  '));
  if (r.url) console.log(`              ${r.url}`);
  for (const note of r.notes || []) console.log(`              - ${printable(note)}`);
}

async function main() {
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
      result = { label: labelOf(pr), status: 'failed', why: err.message.split('\n')[0] };
    }
    printLine(result);
  }

  if (!opts.targets.length) {
    Object.assign(ctx, loadHerdr(opts.dryRun));
    try {
      const order = await orderTabs(ctx, prs, opts.dryRun);
      if (order) printLine({ status: opts.dryRun ? 'would order' : 'ordered', label: 'tabs', why: order });
    } catch (err) {
      failed++;
      printLine({ status: 'failed', label: 'tabs', why: err.message.split('\n')[0] });
    }
  }
  process.exitCode = failed ? 1 : 0;
}

if (require.main === module) {
  main().catch(err => {
    console.error(`review-prs: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  changedFiles, matchesAny, within, installGate, jiraKey, ignoredWork, MISE_SENSITIVE, CLAUDE_CONFIG, PM_CONFIG, NO_HOOKS,
};

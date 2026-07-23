---
name: sandbox-friction
description: Diagnose a Claude Code sandbox block (filesystem/network/socket denial) and propose the minimal, correctly-schemaed settings.json change to unblock it. Use the moment a command fails with "Operation not permitted", a network/DNS failure, a unix-socket error, or any "sandbox blocked" message — and when reviewing the accumulated .claude/sandbox-friction.jsonl log during reflection.
user-invocable: true
---

# Sandbox Friction → Config Fix

The sandbox causes **hard failures**, not permission prompts. This skill turns a block (or a log of
past blocks) into the narrowest settings.json change that unblocks it — written in the **correct
schema**, then handed to `update-config` to apply.

Do not silently work around a block with `dangerouslyDisableSandbox`; that fixes one command and
loses the signal. Capture the friction and propose a durable, scoped fix.

## When to Use

- A command just failed with a sandbox signature (see below) and the right fix is a config change,
  not a different command.
- You're reflecting and `.claude/sandbox-friction.jsonl` has captured blocks to triage.
- You hit the same wall twice — that's a missing allow-rule, not bad luck.

## Critical: the schema you SEE ≠ the schema you WRITE

The runtime sandbox is *described* to the agent with one vocabulary, but `settings.json` uses
another. Writing the runtime names into config produces **silently broken config**. Translate:

| Runtime description (what you see)        | settings.json key (what you write)            |
| ----------------------------------------- | --------------------------------------------- |
| `filesystem.write.allowOnly` / writable   | `sandbox.filesystem.allowWrite`               |
| `filesystem.read.denyOnly` / readable     | `sandbox.filesystem.allowRead` (deny via `denyRead`) |
| `network.allowedHosts`                    | `sandbox.network.allowedDomains`              |
| `allowUnixSockets`                        | `sandbox.network.allowUnixSockets`            |
| (a command run unsandboxed)               | `sandbox.excludedCommands`                    |

Always confirm the live keys before proposing a diff — read the project's `settings.json` `sandbox`
block rather than trusting this table blindly; the schema can evolve.

## Workflow

### 1. Classify the block

Map the failure signature to a layer:

| Signature                                                          | Layer            |
| ------------------------------------------------------------------ | ---------------- |
| `Operation not permitted`, `Read-only file system` on a write path | filesystem write |
| Read denied on a path outside the allow set                        | filesystem read  |
| `Could not resolve host`, `Connection refused`, `Network is unreachable` to a known host | network domain |
| Unix-socket connect error (e.g. docker.sock)                       | unix socket      |
| A whole tool/binary that can't function sandboxed                  | excluded command |

If the signature is ambiguous, say so and propose the narrowest plausible fix — don't guess wide.

### 2. Choose the narrowest fix (escalation ladder)

Prefer the top rung that unblocks the task. Never jump to the bottom to "be safe."

1. **Add the specific path / host / socket** to the matching allow list. One entry, as narrow as
   possible (`~/.foo/cache`, not `~`; `api.example.com`, not a wildcard).
2. **Add the binary to `excludedCommands`** only if the tool genuinely cannot run sandboxed
   (needs broad fs/network access by nature, e.g. a browser or a package manager's installer).
3. **One-off `dangerouslyDisableSandbox: true`** on a single command — for a true one-time action,
   not a recurring need. This is a workaround, not a fix; still log it.
4. **Disabling the sandbox** is out of scope for this skill. If you think it's warranted, stop and
   ask the user explicitly.

### 3. Safety rails (do not cross)

- **Never** add secret-bearing or credential paths to an allow list: `~/.ssh`, `~/.aws`,
  `~/.config/gh`, `.env*`, keychains, token files. If the task seems to need one, surface it — don't
  silently widen access.
- **Never** propose a wildcard host (`*`) or a home-dir-wide write (`~`, `~/`). Narrow or nothing.
- Prefer a **project-local** `.claude/settings.json` change over the **global** `~/.claude` one when
  the need is project-specific. Only widen the global config for genuinely cross-project needs.

### 4. Propose the diff, then hand off

- Show the exact JSON to add and which file (project vs global), with a one-line rationale tied to
  the blocked command.
- Apply it via the **`update-config`** skill (it owns settings.json edits and permission semantics).
  This skill diagnoses; `update-config` writes.
- If you triaged entries out of `.claude/sandbox-friction.jsonl`, note which lines are now resolved
  so the log doesn't re-surface them.

## Relationship to other tools

- **`update-config`** — applies the settings.json change. Always route the write through it.
- **`fewer-permission-prompts`** — different layer: it trims approval *prompts* (allow/ask/deny),
  not sandbox *blocks*. Don't confuse a prompt with a hard sandbox denial.
- **`post-implementation-reflection`** — its Agent QoL lens delegates here when sandbox friction
  shows up in a retro.

# Security Policy

Nosy reads your shell configuration, runs diagnostic commands, and — with your confirmation — edits
files in your home directory. That is a meaningful amount of trust, so security reports get taken
seriously here.

## Supported versions

Only the latest release receives fixes. Nosy is pre-1.0 and there are no maintenance branches.

| Version | Supported |
|---|---|
| Latest release | ✅ |
| Anything older | ❌ |

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Use GitHub's private reporting instead:

**[→ Report a vulnerability privately](https://github.com/2026osscontest/nosy/security/advisories/new)**

This creates a draft advisory visible only to you and the maintainers.

Please include:

- What an attacker could achieve, and what access they'd need to start
- Steps to reproduce, or a proof of concept
- The Nosy version (menu bar → the app's version, or the `.dmg` filename you installed)
- Your macOS version and shell

You can expect an initial response within **7 days**. If a fix is warranted, we'll work out disclosure
timing with you and credit you in the advisory unless you'd rather stay anonymous.

## What counts

Nosy's trust boundary is narrow but real. These are in scope:

- **Command injection** — a crafted rc file, filename, or diagnostic output that causes Nosy to
  execute something unintended
- **Path traversal** — reading or writing outside the paths a finding legitimately covers
- **Destructive fixes** — a fix that deletes data, resets global configuration, or can't be reverted
  when the UI says it can
- **Privilege escalation** — any path that gets a `sudo` command executed without the user running it
  themselves
- **Backup failures** — a file edited without the `.bak.<timestamp>` copy being written first
- **Data exfiltration** — anything that sends the contents of your configuration off the machine

Nosy makes no network requests and has no telemetry, no accounts, and no server. If you find code
that contradicts that, it's a vulnerability report, not a bug report.

## What doesn't count

- **The `xattr -dr com.apple.quarantine` step in the install instructions.** This is a known and
  documented consequence of shipping without Apple notarization, which requires a paid Developer
  account. It is not a vulnerability in Nosy — see the README.
- **False positives and false negatives in diagnostics.** Those are correctness bugs. Please file
  them as [issues](https://github.com/2026osscontest/nosy/issues) — false positives especially, they
  matter a lot to us.
- **Vulnerabilities in the tools Nosy diagnoses.** Report those to their maintainers.
- **Attacks requiring an already-compromised machine.** If someone can already write to your
  `.zshrc`, they don't need Nosy.

## Security-relevant design

For context when assessing a report, these are deliberate properties of the system:

- Adapters reach the filesystem and shell only through `DiagnosticHost`. Nothing in
  `packages/core/src/adapters/` imports `node:fs` or `node:child_process` directly, which keeps the
  entire I/O surface in one reviewable file.
- Fixes require explicit confirmation, back up before writing, never auto-run `sudo`, and exclude
  destructive operations outright.
- The renderer runs with `contextIsolation` enabled and reaches the main process only through a
  preload bridge. `nodeIntegration` is off. The sandbox is disabled because Electron requires it for
  ESM preload scripts — that one exception is documented in `apps/pet/main/window.ts`.
- Snapshots are stored unencrypted in `~/.nosy/`. They contain excerpts of your configuration files,
  so treat that directory as you would the files themselves.

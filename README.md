<div align="center">

<img src="assets/character/preview/idle_0.png" width="110" alt="Nosy">

# Nosy

**A desktop pet that diagnoses your development environment.**

Diagnostic tools tell you that something is wrong.<br>
Nosy tells you which file, which line, and what to run.

[![CI](https://github.com/2026osscontest/nosy/actions/workflows/ci.yml/badge.svg)](https://github.com/2026osscontest/nosy/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/2026osscontest/nosy)](https://github.com/2026osscontest/nosy/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%2012%2B-lightgrey)](#requirements)

**English** · [한국어](README.ko.md)

</div>

---

## Why

Shell configuration rots quietly.

A `PATH` entry points at a directory you deleted months ago. An alias targets a binary that no longer
exists. A `source` line loads a file that isn't there. Your version manager's init line drifted to the
middle of the file and stopped taking effect. Nothing crashes — things just get slower, or subtly
wrong, and one day *"works on my machine"* stops being a joke.

The tools that could catch this are scattered and mostly invisible. Package managers and language
runtimes ship their own diagnostic commands, and most developers have never run any of them. And when
they do, the output says **what** is broken, not **where** to fix it.

Nosy runs those checks for you, on a schedule, and puts the answer on your screen: the file, the line
number, the offending text, and the command that fixes it.

## What it catches

Nosy is not a new diagnostic engine. It combines checks that already exist — plus a few of its own —
behind one score.

<table>
<tr><th align="left">Adapter</th><th align="left">Looks for</th></tr>
<tr><td><code>shell-rc</code></td><td>
Duplicate <code>PATH</code> entries · <code>PATH</code> entries pointing at missing directories ·
aliases whose target command doesn't exist · duplicate alias definitions ·
<code>source</code> of files that aren't there · conflicting version-manager init lines
</td></tr>
<tr><td><code>version-manager</code></td><td>
pyenv/nvm shims outranked by system binaries in <code>PATH</code> ·
<code>.nvmrc</code> / <code>.python-version</code> disagreeing with the active version ·
init lines that aren't last in the rc file · managers installed with no init line at all
</td></tr>
<tr><td><code>homebrew</code></td><td>
The package manager's own diagnostics, folded into the same score and format
</td></tr>
</table>

## Features

**It points at the cause, not just the symptom.** Every finding that originates in a file carries the
path, the line number, and the offending text. Findings that don't come from a file carry a command
you can run instead. That pairing — *symptom → file:line → the fix* — is the whole point.

**One score across tools.** Findings from every adapter fold into a single number. It starts at 100
and deducts 5 per warning and 15 per error, capped at 30 per adapter so one noisy tool can't sink the
whole score.

**It notices when things change.** Each run is compared against the last snapshot
(`~/.nosy/snapshots/latest.json`). When a new error appears that wasn't there before, the pet reacts
immediately instead of waiting for you to ask.

**Fixes are deliberately timid.** See [What Nosy won't do](#what-nosy-wont-do).

**It lives on your screen.** A transparent, always-on-top pet with no Dock icon. Its expression
follows the score.

<div align="center">
<img src="assets/character/preview/idle_0.png" width="72" alt="idle">
<img src="assets/character/preview/thinking_0.png" width="72" alt="thinking">
<img src="assets/character/preview/worried_0.png" width="72" alt="worried">
<img src="assets/character/preview/alarmed_0.png" width="72" alt="alarmed">
<br>
<sub><b>idle</b> · <b>thinking</b> · <b>worried</b> · <b>alarmed</b></sub>
</div>

## Requirements

- **macOS 12 (Monterey) or later.** Apple Silicon and Intel are both supported.
- Nosy is macOS-only for now. The adapters assume macOS paths and shell conventions.

> [!NOTE]
> **The app's interface is in Korean.** Menu bar entries, health grades, and finding descriptions are
> all Korean text. File paths, line numbers, and shell commands — the part you act on — are language
> neutral. English UI is on the [roadmap](#roadmap).

## Install

### Homebrew

```sh
brew tap 2026osscontest/nosy
brew trust 2026osscontest/nosy
brew install --cask nosy
xattr -dr com.apple.quarantine /Applications/Nosy.app
```

Two of those lines are unusual, and both are required:

- **`brew trust`** — Homebrew refuses to load casks from third-party taps until you trust them.
  Without it the install stops at `Refusing to load cask ... from untrusted tap`.
- **`xattr`** — see [why](#why-the-xattr-step) below.

### Direct download

Grab the `.dmg` for your Mac from the [latest release](https://github.com/2026osscontest/nosy/releases/latest),
drag Nosy to Applications, then run:

```sh
xattr -dr com.apple.quarantine /Applications/Nosy.app
```

| Mac | File |
|---|---|
| Apple Silicon | `Nosy-<version>-arm64.dmg` |
| Intel | `Nosy-<version>-x64.dmg` |

### Why the `xattr` step?

Nosy is signed ad-hoc but **not notarized by Apple** — notarization requires a paid Apple Developer
account. macOS quarantines unnotarized apps and refuses to open them, and that command clears the
flag. It is a one-time step per install.

If you'd rather not run it, you can right-click the app → **Open** → **Open** instead. Same effect,
more clicks.

### From source

```sh
git clone https://github.com/2026osscontest/nosy.git
cd nosy
pnpm install
pnpm --filter @nosy/core build   # apps/pet links against core's dist/
pnpm --filter @nosy/pet dev
```

## Usage

Nosy runs in the **menu bar with no Dock icon**. The pet sits on your screen; the menu bar is where
you manage the app.

| | |
|---|---|
| **Click the pet** | Opens a speech bubble, then the detail panel |
| **Detail panel** | File path, line number, the offending text, and the fix — with a toggle to apply it |
| **Menu bar** | Run diagnostics now · Hide the pet · Motion · Start at login · Quit |

Diagnostics run when the app starts, every 30 minutes, when your machine wakes from sleep, and
whenever a watched rc file changes.

**To stop Nosy from starting at login**, uncheck *Start at login* in the menu bar. It is off unless
you turn it on.

## How it works

```
   adapters                     core                        pet
┌───────────────┐      ┌────────────────────┐      ┌──────────────────┐
│ shell-rc      │      │                    │      │                  │
│ version-      │─────▶│  Finding[]         │─────▶│  health score    │
│   manager     │      │   ├─ evidence      │      │  pet expression  │
│ homebrew      │      │   │   file:line    │      │  detail panel    │
└───────────────┘      │   └─ fix           │      └──────────────────┘
        ▲              │       command      │
        │              │       or edit      │
   DiagnosticHost      └─────────┬──────────┘
   (all filesystem and           │
    shell access goes            ▼
    through here)          ~/.nosy/snapshots
                           compare → drift
```

Every adapter receives a `DiagnosticHost` and touches the filesystem and shell only through it. That
single seam is what makes adapters testable without a real machine — and what makes writing a new one
straightforward. See [CONTRIBUTING.md](CONTRIBUTING.md).

## What Nosy won't do

Nosy edits your shell configuration. That deserves stated limits.

- **It never runs `sudo` for you.** Commands needing elevation are shown to copy, never executed.
- **It backs up before editing.** Every file it modifies is copied to `<file>.bak.<timestamp>` first.
- **It asks first.** No fix runs without explicit confirmation.
- **It won't do destructive work.** Deleting files or packages and resetting global configuration are
  excluded from fixes entirely — not gated behind a warning, excluded.
- **It disables undo when it can't undo.** If a fix has no revert path, the revert button is greyed
  out rather than lying to you.
- **It sends nothing anywhere.** Diagnostics run locally. There is no telemetry, no network call, no
  account. Snapshots stay in `~/.nosy/`.

## Roadmap

- `git` and `docker` adapters — specs are written, implementation isn't
- English UI
- Exposing diagnostics over MCP, so coding agents can check the environment before blaming the code
- Linux and Windows adapters
- 3D character (the renderer is isolated to one component to make this a swap, not a rewrite)

## Contributing

Bug reports, false-positive reports, new adapters, and documentation are all welcome.

A **false positive is the most valuable report you can file** — a diagnostic tool that cries wolf is
worse than no tool. If Nosy flagged something that was actually fine, please
[tell us](https://github.com/2026osscontest/nosy/issues/new?template=false-positive.yml).

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture rules, and a walkthrough of
writing a new adapter.

## License

[MIT](LICENSE).

Every dependency has been audited — no GPL, AGPL, or LGPL anywhere in the tree. See
[`docs/LICENSE-AUDIT.md`](docs/LICENSE-AUDIT.md) for the breakdown and
[`sbom.json`](sbom.json) for the CycloneDX SBOM.

### Acknowledgements

- **[shellrc-doctor](https://github.com/nord342/shellrc-doctor)** (MIT) — the shell rc diagnostic ideas
  behind the `shell-rc` adapter, reimplemented in TypeScript rather than called at runtime.
- **[Galmuri](https://github.com/quiple/galmuri)** (SIL OFL 1.1) — the pixel font bundled for the
  pet's speech bubble.

Full notices in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

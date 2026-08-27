<!--
Thanks for the PR. Keep it to one concern — an adapter and a UI refactor in one PR is two PRs.
Korean or English are both fine.
-->

## What does this change?

<!-- And why. The diff already says what; the reasoning is the part we can't reconstruct later. -->

## Related issue

<!-- Fixes #123, or "none" for small fixes. -->

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`)

### If this changes diagnostic behaviour

- [ ] The matching `docs/specs/` file is updated in this PR — specs are the source of truth
- [ ] Tests cover the healthy case too, not just the failing one
- [ ] Finding IDs are stable across runs (no timestamps, no random values, no array indices — drift
      detection compares them between snapshots)
- [ ] Every new finding carries either `evidence` (file/line/excerpt) or `fix.command`

### If this adds or changes an adapter

- [ ] The adapter reads and executes **only** through `DiagnosticHost` — no `node:fs` or
      `node:child_process` imports
- [ ] Tests use `FakeHost`, not the real filesystem
- [ ] `skipReason` returns a user-readable reason when the tool isn't installed
- [ ] No fix is destructive (no deleting files or packages, no resetting global config)
- [ ] Registered in `packages/core/src/run.ts` and exported from `packages/core/src/index.ts`

### If this touches the Electron app

- [ ] Verified in a **packaged build launched from Finder**, not just `pnpm dev` — the two inherit
      different `PATH` values and some bugs only appear in the former
- [ ] Pet rendering changes stay inside `renderer/PetView.tsx`

<!--
Architecture rules with recorded rationale live in docs/ADR.md, including a list of
settled questions ("재논의 금지 항목"). Worth a look before proposing structural changes.
-->

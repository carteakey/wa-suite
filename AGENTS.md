# WA Suite agent instructions

## Planning authority

Linear is the planning authority for committed work in this repository.

- Project: [WA Suite](https://linear.app/carteakey/project/wa-suite-2c2597c0fa0a)
- Milestone: Privacy-safe backlog completion — 2026-08-10
- Canonical backlog section: `/Users/kchauhan/repos/TODO_REPORT.md` (the WA Suite section only)
- Repository Markdown remains authoritative for implementation and behavior.

Do not create a second backlog in repository TODO files, GitHub Issues, or Forge.
Keep speculative ideas in the existing repository TODO files until they are
intentionally promoted to Linear.

## Privacy boundary

Chat exports, contacts, profile JSON/Markdown/XLSX, images, Office temporary
files, matching-person data, WhatsApp sessions, checkpoints, and generated
descriptions are private local artifacts. Do not inspect more than needed, log
their contents, stage them, publish them, or commit them. Sanitized fixtures may
be committed only when they contain no real names, phone numbers, message text,
images, credentials, or identifying metadata.

## Safety defaults

Destructive WhatsApp operations must default to dry-run, target only messages
sent by the authenticated user, require explicit opt-in for live mutation, and
report aggregate outcomes without printing private message bodies or contact
identifiers. Tests must use account-free sanitized fixtures.

## Verification

Run focused Node/Python tests and shell checks before committing. Before every
commit or push, audit staged files, untracked candidates, and diffs for secrets
and private artifacts; preserve unrelated dirty-tree changes.

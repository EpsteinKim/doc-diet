---
name: keep-heads-fresh
description: Use when recording a decision, rule change or fix in a project whose docs are split into a short head plus a *.record.md. Keeps the head from going stale.
---

# keep-heads-fresh

Applies to projects using doc-diet (a head `<name>.md` plus a record `<name>.record.md`).

1. **Decision goes into the head the same turn.** When you record a decision or rule change in the record, put it in the relevant head in that same turn, with a `(record §N)` pointer. Otherwise the head silently keeps yesterday's rule.
2. **Wrong verdicts are struck through in the record, not deleted** (`~~old verdict~~`, then the correction). Remove or replace the same claim in the head; the head carries only what is true now.
3. **300-line cap on the head.** If an addition would exceed it, move something older behind a `(record §N)` pointer instead of growing the head.
4. New history, measurements and bug narratives go in the record only.
5. After a substantial head edit, suggest `/doc-diet:check <head>` to re-measure.

## Hook nudges

doc-diet hooks may add context lines ("head is over the cap", "a decision was recorded", "N commits since last check", "doc X has no record"). They only suggest. Act on them at a natural moment: do the head edit yourself for the first two; for the others tell the user and let them choose. Settings live in `.doc-diet.json` (see README).

## Optional: several subagents per area

- One standing owner per area doc; the owner updates that head and record.
- When an owner's context is about half full, have it write what it learned into the docs and hand over to a fresh agent that starts from the head.
- When direction changes, issue the correction once, in the doc, not repeatedly in prompts the next agent never sees.

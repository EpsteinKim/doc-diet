# Design notes

Notes for whoever works on this next, including a Claude session opened in this folder. The README is for people installing it. No files from the project where the method was first used are in this repo.

## The problem

Agent docs grow until every session reads thousands of lines of history before doing any work. If you summarise them, you can't tell what was dropped. doc-diet keeps the original as a byte copy, writes a short head, and runs an agent against the head to see what it misses.

## Decisions

- The record is a plain copy of the original, with no header prepended. `cmp` is the whole proof; a header would mean the verify step needs a parser instead.
- The head is rewritten from scratch, not trimmed. Deleting paragraphs from a 4,000-line doc keeps the old doc's shape. Writing 150-300 lines with a `(record §N)` pointer on each means every line gets rechecked against the record.
- Citations in other documents (`<name>.md §N`, old section numbers) resolve to the record. Renumbering them across a repo touches too many files to do safely, so the head says so in its first two lines.
- `doc-tester` answers from the head alone and marks each answer in-head / not / ambiguous before it is told it may open the code or the record. If it could grep the code while answering, the head would never be tested.
- Questions come from the user, or `/doc-diet:check` proposes some from a decisions file the user names. Made-up questions tend to be easy for the head; past mistakes make better ones. Generating questions with no file to draw from is 0.2.0.
- Hooks only add context. A hook that edits docs on its own is hard to predict. The record reminder appears on every session start; every other nudge appears once per session per file. The "changed since last check" scan looks at the first 20 heads only, to keep session start cheap on repos with many. Without `node` the hooks print nothing.
- `recordSuffix` is configurable because teams name these files in their own language. `.record.md` is the default; `.기록.md` is what the first project uses.

## What exists (0.1.0)

| Piece | File | Does |
|---|---|---|
| split | `skills/split-doc/SKILL.md` | copy original to record, write head, run the verify script |
| verify | `scripts/verify-split.sh` | `cmp` record vs original; grep each backticked name in the head against record and code |
| check | `commands/check.md` + `agents/doc-tester.md` | read head only, answer, then grade against code and record |
| mark | `scripts/mark-checked.mjs` | write `.doc-diet/last-check.json` so the "time to measure" nudge resets |
| nudges | `hooks/hooks.json` + `scripts/nudge.sh` + `scripts/nudge.mjs` | SessionStart and PostToolUse context lines; see README |
| upkeep | `skills/keep-heads-fresh/SKILL.md` | decision into head same turn; strike through, don't delete; 300-line cap |

Config keys and defaults live in `scripts/nudge.mjs` (`C`), and the README must match them. When one changes, change the other in the same commit.

## Not done yet

- Generating questions without a decisions file (0.2.0).
- A check that each `(record §N)` pointer in a head points at a section that exists in the record.
- Measuring the head's byte count and read time from outside the agent instead of trusting its self-report.
- Tests for `nudge.mjs`. It was exercised by hand on one repo with about 5,000 files.

## Numbers that were measured once

On the first project (11 area docs plus a shared one, largest 4,400 lines): startup reading for an area agent fell from about 440 KB to about 70 KB; three heads read in 2-5 seconds each; the third check round found two rules missing from heads. These are in the README. If they are re-measured, update both places.

## Working on this repo

`claude --plugin-dir /path/to/doc-diet` loads it without installing. The marketplace is this repo itself (`.claude-plugin/marketplace.json`); `/plugin marketplace add EpsteinKim/doc-diet` then `/plugin install doc-diet@doc-diet` is the install path and has been run once end to end. Bump `version` in both `plugin.json` and `marketplace.json` together.

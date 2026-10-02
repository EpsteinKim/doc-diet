# doc-diet

Slim down the docs your AI agents read (`CLAUDE.md`, per-area knowledge files) **losslessly**, then **measure** that a fresh agent reading only the slim version still answers correctly.

## Why

Long-lived projects grow agent docs into thousands of lines: history, measurements, bugs already fixed. Every session or subagent reads all of it, so startup is slow, context fills early, and the live rules drown in backstory. Summarising fixes the size but leaves two questions unanswerable: *what did we lose?* and *is the summary right?* doc-diet answers both mechanically.

## Install

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

Local try-out: `claude --plugin-dir /path/to/doc-diet`.

## Features

**1. Split a doc (skill `split-doc`).** Ask Claude to split a long doc. It copies the original byte-for-byte to `<name>.record.md`, rewrites `<name>.md` as a 150-300 line head (rules that are true now, pitfalls, decisions, open items; each line ends with `(record §N)`), and runs `scripts/verify-split.sh`: `cmp` proves the record is identical to the original, and backtick names in the head are grep-checked against the record and code.

**2. Measure comprehension (`/doc-diet:check <head-file> [questions...]`).** A read-only `doc-tester` agent reads only the head (timed, bytes counted), answers your questions marking each *in-head / not / ambiguous*, then greps code and record to grade *right / partial / wrong*.

```
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

Also included: a `keep-heads-fresh` skill with the maintenance rules (decision goes into the head the same turn, strike wrong verdicts in the record, 300-line cap), and hooks that nudge so you do not have to ask (below).

## Automatic nudges

Hooks only add a line of context for Claude; they never split or edit a doc. Needs `node` on PATH (silently does nothing without it). Each nudge fires at most once per session and per file (state in `${CLAUDE_PLUGIN_DATA}`, else `$TMPDIR`, keyed by session id, else by calendar day).

| When | Fires if | Says |
|---|---|---|
| SessionStart | project has records | read heads in full, grep records on demand (every start) |
| SessionStart | `CLAUDE.md`, `AGENTS.md`, `.claude/**/*.md` or `docGlobs` file exceeds `bigDocLines` or `bigDocBytes` and has no record | suggest `split-doc` |
| SessionStart | a head changed in `measureAfterCommits`+ git commits since its last `/doc-diet:check` | suggest `/doc-diet:check <head>` |
| After Edit/Write/MultiEdit | an edited head (has a record) is over `maxHeadLines` | move detail into the record |
| After Edit/Write/MultiEdit | the file matches `decisionGlobs` (off by default) | put the rule into the head this turn |

`/doc-diet:check` writes `.doc-diet/last-check.json` (head path to git commit) via `scripts/mark-checked.mjs`; commit it or gitignore it as you like. The session scan is depth-limited (6) and skips `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `vendor`, `target`; about 50 ms on a 5,000-file tree.

### Config: `.doc-diet.json` (optional, project root, all keys optional)

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

Globs are relative to the project root (`*` within a folder, `**` across folders). Use `recordSuffix` for projects that name records differently, e.g. `.history.md`.

## Results (hand-applied, anonymised)

On one internal business web app with 11 area docs plus a shared doc (largest 4,400 lines): what an owner reads at start dropped from about 440 KB to about 70 KB (roughly 1/6), three docs read in 2-5 seconds. The third measurement round found two important rules missing from the heads: an exception lost while summarising, and a decision made the day before that had not reached the head yet.

## Compared with similar tools

- `agent-md-refactor` (softaworks/agent-toolkit): splits a big doc into linked files; prunes as it goes, no verification.
- `claude-token-diet` (MUKE-coder): a bundle of token-saving settings (deny rules, slimmer CLAUDE.md, LSP). Similar name, different thing.
- claude-mem / Mem0 / Hindsight: memory of conversations and work history; different target.
- **doc-diet only:** lossless archive proven with `cmp`, fresh-agent comprehension measurement with grading, and a list of places where the doc disagrees with the code.

## Limitations

- Context-percent and timing figures come from the agent itself and are self-reported.
- The measurement is only as good as the questions: use questions with known answers, ideally from real past mistakes.
- Questions are not auto-generated yet (planned for 0.2.0).
- The head is written by Claude; review it, the `cmp` check only protects the record.

## License

MIT

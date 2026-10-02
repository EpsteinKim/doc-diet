**English** · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh.md)

# doc-diet

`CLAUDE.md` and the knowledge files your agents read keep growing. Mine got to 11 area docs plus a shared one, the biggest at 4,400 lines, and every subagent read the whole pile before starting on anything. Summarising is the obvious answer, but then you can't tell what was thrown away, or whether the summary is right.

doc-diet does the cut in a way you can check afterwards. The original is kept, byte for byte, as `<name>.record.md`. A short version of `<name>.md` (150-300 lines) replaces it with only what is still true, each line pointing back to where it came from in the record. The plugin calls the short version the head. Then a fresh agent reads the head on its own and gets asked questions, so you find out what the cut lost before you need it.

## Install

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

Or without installing: `claude --plugin-dir /path/to/doc-diet`.

## What's in it

### split-doc

Ask Claude to split a file and this skill takes over. It copies the original to `<name>.record.md`, rewrites `<name>.md` as the head, and runs `scripts/verify-split.sh`. The script runs `cmp` on the record against the original, then greps every backticked name in the head against the record and your code.

### /doc-diet:check

`/doc-diet:check <head-file> [questions...]` sends a read-only agent called `doc-tester` to read the head and nothing else. It answers your questions from that alone, marks each answer in-head / not / ambiguous, and only afterwards goes to the code and the record to grade itself right / partial / wrong.

```
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

You supply the questions, or point it at a decisions file and let it pick some. Questions about things that went wrong before work best. Generating them automatically is planned for 0.2.0.

### keep-heads-fresh

Three rules: when you record a decision, put it in the head in the same turn; when a verdict turns out wrong, strike it through in the record instead of deleting it; keep the head under 300 lines.

## Hooks

Two hooks. Each adds one line of context and never touches a file. They need `node` on PATH and stay silent without it. Each one fires once per session per file, with state kept in `${CLAUDE_PLUGIN_DATA}` or, if that is unset, `$TMPDIR`, keyed by session id or by date.

When a session starts:

- if the project has record files, Claude is told to read heads in full and to grep a record only when following a `(record §N)` pointer
- if `CLAUDE.md`, `AGENTS.md`, a file under `.claude/`, or a `docGlobs` match is longer than `bigDocLines` or bigger than `bigDocBytes` and has no record, it suggests a split
- if a head has changed in `measureAfterCommits` or more commits since its last `/doc-diet:check`, it suggests checking again

After Edit, Write or MultiEdit:

- if the file is a head and now exceeds `maxHeadLines`, it says so
- if the file matches `decisionGlobs` (nothing by default; the example below turns it on for `docs/decisions/`), it reminds Claude to put the rule into the head this turn

`/doc-diet:check` saves the commit it ran at in `.doc-diet/last-check.json` via `scripts/mark-checked.mjs`. Commit that file or ignore it. The startup scan goes 6 directories deep, skips `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `vendor` and `target`, and takes around 50 ms on a 5,000-file tree.

Settings live in `.doc-diet.json` at the project root. All keys are optional:

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

Globs are relative to the project root. If your records are called something else, change `recordSuffix` (`.history.md`, for example).

## How it went

On the project above, what an owner reads at startup dropped from about 440 KB to about 70 KB; the three area docs I timed read in 2-5 seconds each. More useful: the third round of checks found two rules missing from the heads. One was an exception lost in summarising. The other was a decision from the day before that nobody had copied over. That's why `keep-heads-fresh` exists.

## Caveats

The timings above are self-reported by the agent. It only tests what you ask about. Nothing checks whether the head is right, so read it.

Similar names: `agent-md-refactor` (softaworks/agent-toolkit) splits a doc but prunes and doesn't verify. `claude-token-diet` (MUKE-coder) is a set of token-saving settings. claude-mem, Mem0 and Hindsight store chats, not docs.

MIT.

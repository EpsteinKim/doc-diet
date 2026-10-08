**English** · [한국어](README.ko.md) · [日本語](README.ja.md) · [简体中文](README.zh.md)

# doc-diet 🥗

The knowledge files you feed your AI agents (`CLAUDE.md` and friends) never stop growing, do they?

On the project I was working on, there were 11 area docs and the biggest one was past 4,400 lines. Every time a subagent picked up even a small task, it read the whole thing first. Startup was slow and tokens went out the window.

Cutting them down sounds easy, but once you summarise, you're left wondering: what did I drop? Does the short version still say what the original meant?

**`doc-diet` exists because of that.**
It trims a doc down to 150-300 lines that an agent can actually read, while keeping every line traceable back to the original.
The original is kept as `<name>.record.md`, untouched to the byte. The short version the agent reads (the plugin calls it the head) says on every line which section of the original it came from. Then a fresh agent that has seen only the head gets quizzed, so you find out for real whether the cut lost anything.

## 📦 Install

Through the plugin marketplace:

```bash
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

To try it locally without installing:

```bash
claude --plugin-dir /path/to/doc-diet
```

## ✨ What it does

### 1. `split-doc` (the split skill)

Tell Claude "split this doc" and this skill kicks in.
It copies the original to `<name>.record.md`, writes a fresh head in the file's place, and runs `scripts/verify-split.sh`, which fails on three things: the backup differs from the original (`cmp`), the head is over 300 lines, or a `(record §N)` pointer names a section the record does not have. It also warns about every backticked name in the head (file names, functions, config keys) that your code does not have as a whole word. The record does not count there: a name the code deleted is still in the record, and that stale line is the one this check exists for.

### 2. `/doc-diet:check` (the quiz)

A command for testing whether an agent can answer correctly from the head alone.
A read-only agent called `doc-tester` reads just the head and answers your questions. It marks each answer in-head / not / ambiguous before it's allowed to open the original (record) or the code, and only then grades itself right / partial / wrong.

**Usage:**

```bash
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"
```

**Output:**

```text
# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

You give the questions, or it samples them from your decision files (`decisionGlobs`, `docs/decisions/*.md` by default): one numbered section is one question, and the section body is the known answer. The score goes into `.doc-diet/last-check.json`, so you can see how each head has been doing.

*Tip: questions about edge cases the AI already got wrong once work really well.*

### 3. `keep-heads-fresh` (the upkeep rules)

Three rules so the head keeps up when the decisions change.

1. When you write a decision into a doc, put it in the head in the same turn.
2. When a verdict turns out wrong, strike it through in the original instead of deleting it.
3. Keep the head under 300 lines.

## 🪝 Hooks

Hooks that slip a few lines of context to the agent while it works. They never touch a file, and they need `node` installed (without it they do nothing).

**When a session starts:**

* If the project has `.record.md` files, Claude is told to read heads in full and grep the original only when following a `(record §N)` pointer. This one shows up every session.
* If `CLAUDE.md`, `AGENTS.md` or anything under `.claude/` is too big (over 300 lines or 30 KB by default) and has no backup, it suggests splitting.
* If a head has piled up 5 or more commits since it was last checked, it drops a hint to run `/doc-diet:check`. It looks at the first 20 heads only.
* If there is no `.doc-diet.json` but the project has `.md` files paired as `<name>.md` plus `<name>.<something>.md`, it says which `recordSuffix` to set. Otherwise a project that names records `.기록.md` gets no nudge at all and never learns why.

**Right after a doc is edited (Edit/Write):**

* If a head goes over the line limit (300 by default), it says so.
* If a decisions doc listed in `decisionGlobs` was edited, it reminds Claude to put the rule into the head this turn.

**When Claude is about to stop:**

* If a decisions doc was edited this session and no head was, the first stop is refused with the reason, so the rule gets into a head now (or Claude says in one line why no head changes). The second stop goes through.

Apart from the "this project has records" line, each nudge fires once per session per file. Running `/doc-diet:check` writes the current commit to `.doc-diet/last-check.json`, which resets the commit count. Commit that file or gitignore it, either is fine.

## ⚙️ Settings (`.doc-diet.json`)

Put a `.doc-diet.json` in the project root to change the defaults. Every key is optional, and these are the defaults.

```json
{
  "recordSuffix": ".record.md",
  "maxHeadLines": 300,
  "bigDocLines": 300,
  "bigDocBytes": 30000,
  "docGlobs": [],
  "decisionGlobs": ["docs/decisions/*.md"],
  "measureAfterCommits": 5
}
```

*If you name your backups differently, set `recordSuffix` to something like `.history.md`.*

## 💡 How it went

On a real project, what an area agent reads at startup **dropped from 440 KB to about 70 KB.** The three docs I timed took 2-5 seconds each to read.

The most useful part was `/doc-diet:check`. On the third round it found an exception that had been lost in summarising, and a decision from the day before that nobody had copied into the head. The `keep-heads-fresh` rules exist because of that second one.

**🚨 Caveat:** the timings above are the agent's own report. And `/doc-diet:check` only checks what you ask about. Nobody checks whether the head itself is right, so in the end you still read it once.

## 🤔 Similar tools

* `agent-md-refactor` (softaworks/agent-toolkit): splits a doc, but prunes content as it goes and has no verification.
* `claude-token-diet` (MUKE-coder): less a program than a bundle of token-saving settings.
* claude-mem, Mem0, Hindsight: store chat history, not knowledge docs.

## 📄 License

MIT

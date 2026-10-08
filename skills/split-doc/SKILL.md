---
name: split-doc
description: Use when an agent-facing doc (CLAUDE.md, an area/agent knowledge file) has grown too long to read in full. Splits it losslessly into a short head the agent must read plus a byte-identical record, and proves nothing was lost.
---

# split-doc

Split one long doc into a **head** (`<name>.md`, 150-300 lines, always read) and a **record** (`<name>.record.md`, the untouched original, grepped on demand). The user may choose another record suffix (e.g. `.history.md`); use theirs consistently everywhere below.

Work on one doc at a time. Do not summarise away anything: the record keeps all of it.

## Procedure

1. **Archive the original byte for byte.** Copy `<name>.md` to `<name>.record.md` with `cp`. Add no header, no edit. Also keep a scratch copy outside the repo (e.g. `/tmp/<name>.orig.md`) for step 3.
2. **Write the head anew** over `<name>.md`. Read the whole original first, then write only what is still true now:
   - rules that apply today, pitfalls, settled decisions, open items, and what the tests cover
   - end every line or bullet with its evidence pointer `(record §N)`, where N is the section number in the record
   - leave out history, measurements tables, narrative of how a bug was found, and struck-through verdicts
   - do not copy a number that lives in a file (an expected test count, a limit constant): name the file instead. A copied number is stale the first time the file changes, and nothing can check it
   - line 1-2 of the head must say: citations of the form `<name>.md §N` made by other documents, using the original section numbers, resolve to the **record** file, not this head
   - 150-300 lines total. If it will not fit, move more detail behind `(record §N)` rather than exceeding 300.
3. **Verify** with `${CLAUDE_PLUGIN_ROOT}/scripts/verify-split.sh /tmp/<name>.orig.md <name>.record.md <name>.md [code-dir]`. Always pass the code dir when the doc describes code. A non-zero exit means one of: the record differs from the original (re-copy), the head is over 300 lines (move detail behind pointers), or a `(record §N)` points at a section the record does not have (fix the number). Never edit the check. Backtick names reported as not found in the code are warnings: each is a typo, a name the code no longer has, or a rename; fix the head or list it in the report.
4. **Report** to the user:
   - head line count and bytes, and head size as a percentage of the original
   - anything judged borderline that you left out of the head
   - places where an original sentence **looks inconsistent with the code**. Do not put these in the head; list them separately for the user to judge
   - other files that cite `<name>.md §N` (find with grep) so the user can confirm they should now point at the record

Suggest `/doc-diet:check <name>.md` as the next step to measure whether a fresh agent still answers correctly from the head alone.

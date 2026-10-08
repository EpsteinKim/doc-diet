---
description: Measure whether a fresh agent still answers correctly from a doc head alone
argument-hint: <head-file> [questions...]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs":*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs:*), Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/questions.mjs":*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/questions.mjs:*), Task, Read
---

Measure the head file `$ARGUMENTS` (first word = path to the head; the rest, if any, are the questions).

1. Settle the questions (3-7, each with a known answer):
   - If the user gave questions, use them.
   - Else if the user named a decisions file, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/questions.mjs" 5 <that file>`.
   - Else run `node "${CLAUDE_PLUGIN_ROOT}/scripts/questions.mjs" 5` from the project root: it samples numbered sections from the project's decision files (`decisionGlobs`, default `docs/decisions/*.md`). Each line is `file §N: title`; the question is "what was decided about <title>?", and the known answer is that section's body. Keep only the lines whose title concerns this head's area; if fewer than 3 remain, run it again with a larger count. If the script finds no decision files, ask the user for 3-7 questions with known answers. Do not invent questions yourself: a question written from the head is one the head answers.
2. Spawn the `doc-tester` agent (subagent_type `doc-tester`) with the head path and the full question list (for sampled questions include the `file §N` so the tester can grade against that section). Do not read the head yourself first; that would defeat the isolation.
3. Present the agent's result table (question, answer from head, in-head/not/ambiguous, grade, correct answer), the start/end times and bytes read.
4. Finish with one or two lines headed "What the head should have had": the facts graded wrong/partial or marked not-in-head, phrased as lines to add to the head. Do not edit the head unless the user asks.
5. After presenting, record the check and its score so the "time to measure" nudge resets: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs" <head-file> <right> <total>` from the project root (writes `.doc-diet/last-check.json`), where `right` counts the answers graded right.

---
description: Measure whether a fresh agent still answers correctly from a doc head alone
argument-hint: <head-file> [questions...]
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs":*), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs:*), Task, Read
---

Measure the head file `$ARGUMENTS` (first word = path to the head; the rest, if any, are the questions).

1. Settle the questions (3-7, each with a known answer):
   - If the user gave questions, use them.
   - Else if the user named a decisions file, read it and propose candidate questions whose answers are written there.
   - Else ask the user for 3-7 questions with known answers. Do not invent them yourself.
2. Spawn the `doc-tester` agent (subagent_type `doc-tester`) with the head path and the full question list. Do not read the head yourself first; that would defeat the isolation.
3. Present the agent's result table (question, answer from head, in-head/not/ambiguous, grade, correct answer), the start/end times and bytes read.
4. Finish with one or two lines headed "What the head should have had": the facts graded wrong/partial or marked not-in-head, phrased as lines to add to the head. Do not edit the head unless the user asks.
5. After presenting, record the check so the "time to measure" nudge resets: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/mark-checked.mjs" <head-file>` from the project root (writes `.doc-diet/last-check.json`).

// node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const verify = path.join(root, 'scripts', 'verify-split.sh');
const nudge = path.join(root, 'scripts', 'nudge.mjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'doc-diet-'));
const write = (dir, rel, text) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); return p; };

const RECORD = '# Doc\n\n## 1. Rules\n\nUse `serviceToday()` for dates.\n\n## 2. Traps\n\nSee §2.3 for the cursor.\n\n### 2.3 Cursor\n\n`readCursor` is in list.ts.\n';

function runVerify(dir, head, { code, cap } = {}) {
  const orig = write(dir, 'orig.md', RECORD);
  const rec = write(dir, 'doc.record.md', RECORD);
  const h = write(dir, 'doc.md', head);
  const args = [orig, rec, h]; if (code) args.push(code);
  const r = spawnSync('bash', [verify, ...args], { env: { ...process.env, ...(cap ? { DOC_DIET_MAX_HEAD_LINES: String(cap) } : {}) } });
  return { status: r.status, out: r.stdout.toString() + r.stderr.toString() };
}

test('verify: identical record, valid pointers, names in code => exit 0, no warnings', () => {
  const d = tmp();
  write(d, 'src/list.ts', 'export function readCursor() {}\nexport const serviceToday = () => 1\n');
  const r = runVerify(d, 'Dates: `serviceToday()` (record §1)\nCursor: `readCursor` (record §2.3)\n', { code: path.join(d, 'src') });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /0 name warning/);
});

test('verify: one byte off in the record => exit 1', () => {
  const d = tmp();
  const orig = write(d, 'orig.md', RECORD);
  const rec = write(d, 'doc.record.md', RECORD.replace('Rules', 'Rule'));
  const h = write(d, 'doc.md', 'x\n');
  const r = spawnSync('bash', [verify, orig, rec, h]);
  assert.equal(r.status, 1);
  assert.match(r.stderr.toString(), /record differs/);
});

test('verify: head over the cap => exit 1', () => {
  const r = runVerify(tmp(), 'a\nb\nc\n', { cap: 2 });
  assert.equal(r.status, 1);
  assert.match(r.out, /head is 3 lines, cap is 2/);
});

test('verify: (record §N) that the record lacks => exit 1; dotted numbers match whole', () => {
  const ok = runVerify(tmp(), 'x (record §2.3)\n');
  assert.equal(ok.status, 0, ok.out);
  const bad = runVerify(tmp(), 'x (record §9)\ny (record §2.31)\n');
  assert.equal(bad.status, 1);
  assert.match(bad.out, /no section 9/);
  assert.match(bad.out, /no section 2\.31/);
});

test('verify: a name deleted from the code warns even though the record still has it', () => {
  const d = tmp();
  write(d, 'src/list.ts', 'const x = 1\n');
  const r = runVerify(d, 'Cursor: `readCursor` (record §2.3)\n', { code: path.join(d, 'src') });
  assert.equal(r.status, 0);
  assert.match(r.out, /WARN: `readCursor` not found/);
  assert.match(r.out, /1 name warning/);
});

test('verify: whole-word match, so `can` does not pass on `cancel`', () => {
  const d = tmp();
  write(d, 'src/a.ts', 'function cancel() {}\n');
  const r = runVerify(d, '`can` (record §1)\n', { code: path.join(d, 'src') });
  assert.match(r.out, /WARN: `can` not found/);
});

function runNudge(dir, mode, input = {}, env = {}) {
  const r = spawnSync('node', [nudge, mode], { input: JSON.stringify({ cwd: dir, session_id: 'T', ...input }), env: { ...process.env, CLAUDE_PLUGIN_DATA: path.join(dir, '.state'), ...env } });
  const text = r.stdout.toString().trim();
  return text ? JSON.parse(text) : {};
}
const ctx = (o) => (o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || '';

test('nudge session: non-default record suffix and no config => suggests recordSuffix once', () => {
  const d = tmp();
  write(d, 'docs/a.md', 'head\n'); write(d, 'docs/a.기록.md', 'rec\n');
  write(d, 'docs/b.md', 'head\n'); write(d, 'docs/b.기록.md', 'rec\n');
  const first = ctx(runNudge(d, 'session'));
  assert.match(first, /2 files end in \.기록\.md/);
  assert.match(first, /"recordSuffix": "\.기록\.md"/);
  assert.doesNotMatch(first, /Read heads in full/, 'without config the pairs are not records yet');
  assert.doesNotMatch(ctx(runNudge(d, 'session')), /recordSuffix/, 'once per session');
});

test('nudge session: with config the pairs are records and the reminder appears every time', () => {
  const d = tmp();
  write(d, '.doc-diet.json', '{"recordSuffix": ".기록.md"}');
  write(d, 'docs/a.md', 'head\n'); write(d, 'docs/a.기록.md', 'rec\n');
  assert.match(ctx(runNudge(d, 'session')), /Read heads in full/);
  assert.match(ctx(runNudge(d, 'session')), /Read heads in full/);
});

test('nudge post+stop: a decision edit with no head edit blocks the first Stop, then clears', () => {
  const d = tmp();
  write(d, 'docs/decisions/settled.md', '## 1. x\n');
  write(d, 'docs/a.md', 'head\n'); write(d, 'docs/a.record.md', 'rec\n');
  const post = runNudge(d, 'post', { tool_input: { file_path: 'docs/decisions/settled.md' } });
  assert.match(ctx(post), /records a decision/);
  const stop = runNudge(d, 'stop');
  assert.equal(stop.decision, 'block');
  assert.match(stop.reason, /docs\/decisions\/settled\.md/);
  assert.deepEqual(runNudge(d, 'stop'), {}, 'second Stop goes through');
});

test('nudge post+stop: a head edit after the decision clears the pending flag', () => {
  const d = tmp();
  write(d, 'docs/decisions/settled.md', '## 1. x\n');
  write(d, 'docs/a.md', 'head\n'); write(d, 'docs/a.record.md', 'rec\n');
  runNudge(d, 'post', { tool_input: { file_path: 'docs/decisions/settled.md' } });
  runNudge(d, 'post', { tool_input: { file_path: 'docs/a.md' } });
  assert.deepEqual(runNudge(d, 'stop'), {});
});

test('nudge session: state files older than 14 days are swept', () => {
  const d = tmp();
  const state = path.join(d, '.state', 'doc-diet');
  const old = write(d, '.state/doc-diet/s-old.json', '{}');
  const past = new Date(Date.now() - 20 * 86400e3);
  fs.utimesSync(old, past, past);
  runNudge(d, 'session');
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(path.join(state, 's-T.json')), true);
});

// doc-diet hook logic. Nudges only: never edits docs. Any failure => `{}`.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
const out = (event, lines) =>
  console.log(lines.length
    ? JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: lines.join('\n') } })
    : '{}');

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
const cwd = input.cwd || process.cwd();

let cfg = null;
try { cfg = JSON.parse(fs.readFileSync(path.join(cwd, '.doc-diet.json'), 'utf8')); } catch {}
const DEFAULTS = {
  recordSuffix: '.record.md', maxHeadLines: 300, bigDocLines: 300, bigDocBytes: 30000,
  docGlobs: [], decisionGlobs: ['docs/decisions/*.md'], measureAfterCommits: 5,
};
const C = { ...DEFAULTS, ...(cfg || {}) };

const globRe = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*\/?/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '(.*/)?') + '$');
const matches = (rel, globs) => globs.some((g) => globRe(g).test(rel));
const recordOf = (file) => file.replace(/\.md$/, '') + C.recordSuffix;
const lineCount = (f) => { const s = fs.readFileSync(f, 'utf8'); return s ? s.split('\n').length - (s.endsWith('\n') ? 1 : 0) : 0; };
const fmt = (n) => n.toLocaleString('en-US');

// Once-per-session state. Key: session_id from hook stdin, else the calendar day. Lives in
// CLAUDE_PLUGIN_DATA, else TMPDIR. Files older than 14 days are swept on session start.
const stateDir = path.join(process.env.CLAUDE_PLUGIN_DATA || process.env.TMPDIR || os.tmpdir(), 'doc-diet');
const stateFile = path.join(stateDir,
  (input.session_id ? 's-' + input.session_id : 'd-' + new Date().toISOString().slice(0, 10)).replace(/[^\w.-]/g, '_') + '.json');
let fired = {};
try { fired = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
const once = (key, line) => {
  key = cwd + '|' + key;
  if (fired[key]) return [];
  fired[key] = 1;
  return [line];
};
const saveState = () => { try { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(fired)); } catch {} };

if (mode === 'post') {
  const f = input.tool_input && input.tool_input.file_path;
  if (!f || !f.endsWith('.md')) { out('PostToolUse', []); process.exit(0); }
  const abs = path.resolve(cwd, f), rel = path.relative(cwd, abs);
  const lines = [];
  if (!abs.endsWith(C.recordSuffix) && fs.existsSync(abs)) {
    if (fs.existsSync(recordOf(abs))) {
      // A head was edited: whatever decision was pending for this project is taken as propagated.
      delete fired[cwd + '|pending-decision'];
      if (lineCount(abs) > C.maxHeadLines)
        lines.push(...once('grew:' + rel, `${rel} is a head and is now ${fmt(lineCount(abs))} lines (cap ${C.maxHeadLines}). Move history and detail into ${path.basename(recordOf(abs))} and keep the head under the cap.`));
    }
  }
  if (matches(rel, C.decisionGlobs)) {
    fired[cwd + '|pending-decision'] = rel;
    lines.push(...once('decision:' + rel, `${rel} records a decision. Put the rule into the relevant head this turn, with a (record §N) pointer (keep-heads-fresh).`));
  }
  saveState(); out('PostToolUse', lines); process.exit(0);
}

if (mode === 'stop') {
  // A decision file was edited this session and no head since: do not let the turn end on that.
  // Fires once; the flag is cleared so a second Stop goes through.
  const pending = fired[cwd + '|pending-decision'];
  if (pending) {
    delete fired[cwd + '|pending-decision'];
    saveState();
    console.log(JSON.stringify({ decision: 'block', reason: `${pending} was edited this session but no head (<name>.md with a ${C.recordSuffix} record) was. Put the decision into the relevant head now with a (record §N) pointer, or say in one line why no head changes.` }));
  } else console.log('{}');
  process.exit(0);
}

// session: sweep old state, then a bounded walk for docs and records
try {
  const cutoff = Date.now() - 14 * 86400e3;
  for (const f of fs.readdirSync(stateDir)) {
    const p = path.join(stateDir, f);
    if (p !== stateFile && fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
  }
} catch {}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.venv', 'vendor', 'target']);
const files = [];
(function walk(dir, depth) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isDirectory()) { if (depth < 6 && !SKIP.has(e.name)) walk(path.join(dir, e.name), depth + 1); }
    else if (e.name.endsWith('.md')) files.push(path.relative(cwd, path.join(dir, e.name)));
  }
})(cwd, 0);

const fileSet = new Set(files);
const lines = [];

// 0. No config, and the project's record suffix is not the default: say so, once. A project that
// names records `.기록.md` otherwise gets no nudge at all and never learns why.
const guessSuffix = (list) => {
  const count = {};
  for (const r of list) {
    const m = /^(.*)(\.[^./]+\.md)$/.exec(r);
    if (m && list.includes(m[1] + '.md')) count[m[2]] = (count[m[2]] || 0) + 1;
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
};
if (!cfg) {
  const s = guessSuffix(files);
  if (s && s !== C.recordSuffix)
    lines.push(...once('suffix', `doc-diet: ${files.filter((r) => r.endsWith(s)).length} files end in ${s} next to a plain .md, but there is no .doc-diet.json, so they are not treated as records. If they are, tell the user to add {"recordSuffix": "${s}"} to .doc-diet.json at the project root.`));
}

const isRecord = (r) => r.endsWith(C.recordSuffix);
const records = files.filter(isRecord);
const heads = files.filter((r) => !isRecord(r) && fileSet.has(recordOf(r)));

if (records.length)
  lines.push(`doc-diet: this project splits docs into a short head (<name>.md) and a record (<name>${C.recordSuffix}). Read heads in full. Grep records only when a head line's (record §N) pointer is needed; do not read records whole.`);

// 1. big docs without a record
const isAgentDoc = (r) => /(^|\/)(CLAUDE|AGENTS)\.md$/.test(r) || r.startsWith('.claude/') || matches(r, C.docGlobs);
for (const r of files) {
  if (isRecord(r) || !isAgentDoc(r) || fileSet.has(recordOf(r))) continue;
  const abs = path.join(cwd, r);
  let size; try { size = fs.statSync(abs).size; } catch { continue; }
  const ln = lineCount(abs);
  if (ln > C.bigDocLines || size > C.bigDocBytes)
    lines.push(...once('big:' + r, `${r} is ${fmt(ln)} lines (${fmt(Math.round(size / 1000))} KB) with no record file. Suggest the split-doc skill to the user at a natural moment.`));
}

// 2. heads changed in git since the last /doc-diet:check
let last = {};
try { last = JSON.parse(fs.readFileSync(path.join(cwd, '.doc-diet', 'last-check.json'), 'utf8')); } catch {}
const git = (...a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
for (const h of heads.slice(0, 20)) {
  try {
    const range = last[h] ? [`${last[h].commit}..HEAD`] : ['HEAD'];
    const n = parseInt(git('rev-list', '--count', ...range, '--', h), 10);
    if (n >= C.measureAfterCommits)
      lines.push(...once('measure:' + h, `${h} changed in ${n} commits since ${last[h] ? 'its last /doc-diet:check' : 'it was last measured (never)'}. Suggest running /doc-diet:check ${h} once.`));
  } catch {}
}
saveState();
out('SessionStart', lines);

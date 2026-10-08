// usage: node mark-checked.mjs <head-file> [right total]
// Records the current git HEAD for the head in .doc-diet/last-check.json, with the score when given,
// so the "time to measure" nudge resets and the file shows how each head has been scoring.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [h, right, total] = process.argv.slice(2);
if (!h) { console.error('usage: mark-checked.mjs <head-file> [right total]'); process.exit(2); }
let commit = '';
try { commit = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); } catch {}
fs.mkdirSync('.doc-diet', { recursive: true });
let d = {}; try { d = JSON.parse(fs.readFileSync('.doc-diet/last-check.json', 'utf8')); } catch {}
const entry = { commit, time: new Date().toISOString() };
if (right !== undefined && total !== undefined) entry.score = `${right}/${total}`;
d[h] = entry;
fs.writeFileSync('.doc-diet/last-check.json', JSON.stringify(d, null, 2) + '\n');

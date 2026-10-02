// usage: node mark-checked.mjs <head-file>  -> records current git HEAD for it in .doc-diet/last-check.json
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const h = process.argv[2];
if (!h) { console.error('usage: mark-checked.mjs <head-file>'); process.exit(2); }
let commit = '';
try { commit = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); } catch {}
fs.mkdirSync('.doc-diet', { recursive: true });
let d = {}; try { d = JSON.parse(fs.readFileSync('.doc-diet/last-check.json', 'utf8')); } catch {}
d[h] = { commit, time: new Date().toISOString() };
fs.writeFileSync('.doc-diet/last-check.json', JSON.stringify(d, null, 2) + '\n');

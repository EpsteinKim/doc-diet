// usage: node questions.mjs [count] [file...]
// Prints question candidates for /doc-diet:check from decision files: one per numbered section,
// sampled at random. The question is the section heading; the known answer is the section body.
// With no files, reads decisionGlobs from .doc-diet.json (default docs/decisions/*.md).
import fs from 'node:fs';
import path from 'node:path';

const n = parseInt(process.argv[2], 10) || 5;
let files = process.argv.slice(3);
if (!files.length) {
  let globs = ['docs/decisions/*.md'];
  try { globs = JSON.parse(fs.readFileSync('.doc-diet.json', 'utf8')).decisionGlobs || globs; } catch {}
  for (const g of globs) {
    const dir = path.dirname(g), re = new RegExp('^' + path.basename(g).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    try { files.push(...fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f))); } catch {}
  }
}
if (!files.length) { console.error('no decision files found; pass paths or set decisionGlobs in .doc-diet.json'); process.exit(2); }

const sections = [];
for (const f of files) {
  let text; try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^#+\s*(§?\d+(?:\.\d+)*)\.?\s+(.+)$/.exec(lines[i]);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && !/^#+\s/.test(lines[j])) j++;
    const body = lines.slice(i + 1, j).join('\n').trim();
    if (body.length > 40 && !/^~~/.test(body)) sections.push({ file: f, id: m[1].replace(/^§/, ''), title: m[2].trim(), body });
  }
}
if (!sections.length) { console.error('no numbered sections with a body found'); process.exit(2); }

for (let i = sections.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); [sections[i], sections[k]] = [sections[k], sections[i]]; }
for (const s of sections.slice(0, n))
  console.log(`- ${s.file} §${s.id}: ${s.title}`);

#!/usr/bin/env node
// Assembles docs/site/index.html, a single-page reader that bundles every project document as
// JSON and renders it client-side with marked, linking bare requirement IDs back to their home
// document (scripts/docs-template.html). Output is a complete, standalone HTML document so it
// also works opened directly as a file:// URL.
//
// Usage: node scripts/build-docs.mjs [--out <file>]

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolvePath(__dirname, '..');

const FILES = [
  ['README.md', 'README', 'Start'],
  ['ARCHITECTURE.md', 'Architecture', 'Start'],
  ['docs/CANON.md', 'Canon', 'Requirements'],
  ['docs/FEATURE-GRAPH.md', 'Feature graph', 'Requirements'],
  ['docs/STATE.md', 'State journal', 'Requirements'],
  ['docs/DEFENCE.md', 'Defence notes', 'Delivery'],
  ['AI-USAGE.md', 'AI usage', 'Delivery'],
];

const notesDir = join(ROOT, 'docs/notes');
for (const name of readdirSync(notesDir)
  .filter((f) => f.endsWith('.md'))
  .sort()) {
  FILES.push([`docs/notes/${name}`, name.replace(/\.md$/, ''), 'Research']);
}

FILES.push(['docs/PROJECT-STRUCTURE.md', 'Project structure', 'Process']);
FILES.push(['docs/CONVENTIONS.md', 'Conventions', 'Process']);
FILES.push(['CLAUDE.md', 'Working rules', 'Process']);

const decDir = join(ROOT, 'docs/decisions');
const decisionFiles = readdirSync(decDir).filter((f) => f.endsWith('.md'));
const numOf = (name) => {
  const m = name.match(/^A-(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
decisionFiles.sort((a, b) => {
  if (a === 'README.md') return 1;
  if (b === 'README.md') return -1;
  return numOf(a) - numOf(b);
});
for (const name of decisionFiles) {
  if (name === 'README.md') {
    FILES.push(['docs/decisions/README.md', 'Decisions index', 'Decisions']);
    continue;
  }
  const stem = name.slice(0, -3);
  // e.g. "A-1-mono-repo-with-submodule" -> ["A", "1", "mono-repo-with-submodule"].
  const parts = stem.split('-');
  const prefix = parts[0];
  const num = parts[1];
  const slug = parts.slice(2).join('-');
  const title = `${prefix}-${num} · ${slug.replace(/-/g, ' ')}`;
  FILES.push([`docs/decisions/${name}`, title, 'Decisions']);
}

const docs = FILES.map(([path, title, group]) => ({
  path,
  title,
  group,
  md: readFileSync(join(ROOT, path), 'utf-8'),
}));

// Split the template at the first <div class="topbar">: everything before it goes into <head>,
// the rest into <body>, so the result is a complete standalone HTML document.
const templatePath = join(__dirname, 'docs-template.html');
const template = readFileSync(templatePath, 'utf-8');

const payload = JSON.stringify(docs).replace(/<\//g, '<\\/');
// Formatters may insert whitespace after the comment, so match it loosely and fail loudly when
// the marker is missing instead of emitting a page with no documents.
const DOCS_MARKER = /\/\*__DOCS__\*\/\s*null/;
if (!DOCS_MARKER.test(template)) {
  throw new Error('scripts/docs-template.html: /*__DOCS__*/ null marker not found');
}
const filled = template.replace(DOCS_MARKER, () => payload);

const marker = '<div class="topbar">';
const splitAt = filled.indexOf(marker);
if (splitAt === -1) {
  throw new Error(`build-docs: template marker "${marker}" not found in ${templatePath}`);
}
const head = filled.slice(0, splitAt);
const body = filled.slice(splitAt);

// window.renderMermaid is called by scripts/docs-template.html after every document render.
// Guarded with try/catch so a CDN outage or a file:// CSP block never breaks the rest of the page.
const mermaidScript = `<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>
<script>
try {
  mermaid.initialize({ startOnLoad: false, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
} catch (e) {}
window.renderMermaid = function (el) {
  try { mermaid.run({ nodes: el.querySelectorAll('pre.mermaid') }); } catch (e) {}
};
// The first document was rendered by the inline script above before this hook existed.
window.renderMermaid(document.getElementById('article'));
</script>
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}</head>
<body>
${body}
${mermaidScript}</body>
</html>
`;

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outArg = outIdx !== -1 ? args[outIdx + 1] : 'docs/site/index.html';
const outPath = resolvePath(ROOT, outArg);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, 'utf-8');

console.log(`docs: ${docs.length}`);
console.log(`output: ${outPath}`);

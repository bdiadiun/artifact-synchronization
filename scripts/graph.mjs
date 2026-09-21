#!/usr/bin/env node
// Feature graph tooling. docs/feature-graph.json is the source of truth; `build` scans the imports
// of every node's files and generates docs/FEATURE-GRAPH.md, `check` validates the invariants of
// CLAUDE.md §2 and the freshness of both outputs.
//
// Usage: node scripts/graph.mjs build | check

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRAPH_JSON = 'docs/feature-graph.json';
const GRAPH_MD = 'docs/FEATURE-GRAPH.md';
const CANON_MD = 'docs/CANON.md';

const STATUSES = ['planned', 'approved', 'in-progress', 'review', 'done'];
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];
const CONTRACT_PACKAGE = '@bdiadiun/scoring-contract';
const CONTRACT_SOURCE = 'packages/contract/src/index.ts';

// host-app's own path alias (tsconfig.app.json, vite.config.ts). Without it every `@app/` import
// would be counted as an external package and silently stop being checked.
const APP_ALIAS = '@app/';
const APP_ALIAS_ROOT = 'host-app/src';

const VIEWER_DIR = 'viewer';
const VIEWER_HINT = `${VIEWER_DIR}/ is not checked out, run npm run viewer:setup`;

const readText = (relPath) => readFileSync(join(ROOT, relPath), 'utf8');

const isFile = (relPath) => {
  try {
    return statSync(join(ROOT, relPath)).isFile();
  } catch {
    return false;
  }
};

const isDirectory = (relPath) => {
  try {
    return statSync(join(ROOT, relPath)).isDirectory();
  } catch {
    return false;
  }
};

// The OHIF fork is a pinned local checkout (A-18), so its files may legitimately be absent. When
// they are, paths under viewer/ are taken on trust and the output says how many and why.
const isViewerCheckedOut = isDirectory(VIEWER_DIR);
const isSkippedViewerPath = (relPath) =>
  !isViewerCheckedOut && (relPath === VIEWER_DIR || relPath.startsWith(`${VIEWER_DIR}/`));

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const compareIds = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const sortedUnique = (values, compare = compareText) => [...new Set(values)].sort(compare);

const runPrettier = (args, input) =>
  execFileSync('npx', ['--no-install', 'prettier', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'inherit'],
  });

const formatLikeFile = (text, relPath) => runPrettier(['--stdin-filepath', relPath], text);

// Canon IDs

const canonBody = () => {
  const text = readText(CANON_MD);
  const appendix = /^## Appendix A/m.exec(text);
  return appendix ? text.slice(0, appendix.index) : text;
};

const findIds = (text, classLetters) => {
  const re = new RegExp(`\\b([${classLetters}])-(\\d+(?:\\.\\d+)*)\\b`, 'g');
  return [...new Set([...text.matchAll(re)].map((match) => `${match[1]}-${match[2]}`))];
};

// Import scanning. Limits: regex-based; only whole-line `//` comments are skipped, so specifiers
// inside block comments or string literals are picked up, and `require()` is not scanned.

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s+(?:type\s+)?[\w$*{}\s,]*?\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];

const isCodeFile = (relPath) => CODE_EXTENSIONS.some((ext) => relPath.endsWith(ext));

const scanSpecifiers = (source) => {
  const code = source.replace(/^\s*\/\/.*$/gm, '');
  return IMPORT_PATTERNS.flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[1]));
};

// A published ESM package imports its own modules with the `.js` specifier webpack's
// fullySpecified rule demands, while the file beside it is the TypeScript source it compiles from.
const JS_SUFFIX = '.js';
const TS_SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const typeScriptSourceCandidates = (base) =>
  base.endsWith(JS_SUFFIX)
    ? TS_SOURCE_EXTENSIONS.map((ext) => `${base.slice(0, -JS_SUFFIX.length)}${ext}`)
    : [];

const resolveModule = (base) => {
  const candidates = [
    base,
    ...typeScriptSourceCandidates(base),
    ...CODE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...CODE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  return candidates.find(isFile) ?? base;
};

const withoutQuery = (specifier) => specifier.split('?')[0];

const resolveRelative = (fromFile, specifier) =>
  resolveModule(posix.normalize(posix.join(posix.dirname(fromFile), withoutQuery(specifier))));

const resolveAppAlias = (specifier) =>
  resolveModule(
    posix.normalize(posix.join(APP_ALIAS_ROOT, withoutQuery(specifier).slice(APP_ALIAS.length))),
  );

const packageName = (specifier) => {
  if (specifier.startsWith('node:')) return specifier;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const scanImports = (relPath) => {
  const internal = [];
  const external = [];
  for (const specifier of scanSpecifiers(readText(relPath))) {
    if (specifier.startsWith('.')) internal.push(resolveRelative(relPath, specifier));
    else if (specifier.startsWith(APP_ALIAS)) internal.push(resolveAppAlias(specifier));
    else if (specifier === CONTRACT_PACKAGE) internal.push(CONTRACT_SOURCE);
    else external.push(packageName(specifier));
  }
  return { internal: sortedUnique(internal), external: sortedUnique(external) };
};

const computeImports = (node) =>
  Object.fromEntries(
    sortedUnique(node.files)
      .filter((file) => isCodeFile(file) && (isFile(file) || isSkippedViewerPath(file)))
      .map((file) => [file, isSkippedViewerPath(file) ? node.imports?.[file] : scanImports(file)])
      .filter(([, imports]) => imports !== undefined),
  );

// Normalisation: stable key order, nodes by numeric id, unordered arrays sorted.

const normaliseSlice = (slice) => ({
  id: slice.id,
  title: slice.title,
  branch: slice.branch,
  ...(slice.pr === undefined ? {} : { pr: slice.pr }),
});

const normaliseNode = (node, imports) => ({
  id: node.id,
  name: node.name,
  description: node.description,
  canon: sortedUnique(node.canon, compareIds),
  dependsOn: sortedUnique(node.dependsOn, compareIds),
  slice: node.slice,
  status: node.status,
  verify: node.verify,
  files: sortedUnique(node.files),
  imports,
});

const normaliseGraph = (graph) => ({
  $schema: graph.$schema ?? './feature-graph.schema.json',
  version: graph.version,
  slices: graph.slices.map(normaliseSlice),
  nodes: [...graph.nodes]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((node) => normaliseNode(node, computeImports(node))),
});

const serialiseGraph = (graph) => `${JSON.stringify(graph, null, 2)}\n`;

// Markdown generation

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const tableRow = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const table = (header, rows) =>
  [tableRow(header), tableRow(header.map(() => '---')), ...rows.map(tableRow)].join('\n');
const listOrDash = (values) => (values.length === 0 ? '—' : values.join(', '));
const code = (text) => `\`${text}\``;
const mermaidId = (nodeId) => nodeId.replace('-', '');
const mermaidLabel = (node) => `${node.id} ${node.name}`.replace(/`/g, '').replace(/"/g, '#quot;');

const nodesTable = (graph) =>
  table(
    ['Node', 'Name', 'Canon', 'Depends on', 'Slice', 'Status', 'Verify'],
    graph.nodes.map((node) => [
      node.id,
      node.name,
      listOrDash(node.canon),
      listOrDash(node.dependsOn),
      node.slice,
      node.status,
      node.verify,
    ]),
  );

const importsSummary = ({ internal, external }) => {
  const parts = [];
  if (internal.length > 0) parts.push(`internal: ${internal.map(code).join(', ')}`);
  if (external.length > 0) parts.push(`external: ${external.map(code).join(', ')}`);
  return parts.length === 0 ? ' — no imports' : ` — ${parts.join('; ')}`;
};

const nodeSection = (node) => {
  const files =
    node.files.length === 0
      ? '_No files yet._'
      : node.files
          .map((file) => {
            const imports = node.imports[file];
            return `- ${code(file)}${imports === undefined ? '' : importsSummary(imports)}`;
          })
          .join('\n');
  return [
    `### ${node.id} ${node.name}`,
    node.description,
    `Canon: ${listOrDash(node.canon)}. Depends on: ${listOrDash(node.dependsOn)}. Slice ${node.slice}, status ${code(node.status)}.`,
    `Files:\n\n${files}`,
  ].join('\n\n');
};

const coverageTable = (graph, body) =>
  table(
    ['ID', 'Covered by'],
    findIds(body, 'CQD').map((id) => [
      id,
      listOrDash(graph.nodes.filter((node) => node.canon.includes(id)).map((node) => node.id)),
    ]),
  );

const mermaidDiagram = (graph) =>
  [
    '```mermaid',
    'graph TD',
    ...graph.nodes.map((node) => `  ${mermaidId(node.id)}["${mermaidLabel(node)}"]`),
    '',
    ...graph.nodes.flatMap((node) =>
      node.dependsOn.map((dep) => `  ${mermaidId(dep)} --> ${mermaidId(node.id)}`),
    ),
    '```',
  ].join('\n');

const slicesTable = (graph) =>
  table(
    ['Slice', 'Branch', 'PR', 'Nodes'],
    graph.slices.map((slice) => [
      `${slice.id} — ${slice.title}`,
      slice.branch.includes(' ') ? slice.branch : code(slice.branch),
      slice.pr === undefined ? '—' : `#${slice.pr}`,
      listOrDash(graph.nodes.filter((node) => node.slice === slice.id).map((node) => node.id)),
    ]),
  );

const generateMarkdown = (graph, body) =>
  `${[
    '# Feature graph',
    'Generated from docs/feature-graph.json by `npm run graph:build`. Do not edit by hand.',
    'Derived from [CANON.md](CANON.md). Every node closes at least one canon ID. A node is started only when all of its dependencies are `done`. Bonus nodes (`S-*`) are planned only after the mandatory part is `done`.',
    `Statuses: ${STATUSES.map(code).join(' → ')}.`,
    '## Nodes',
    nodesTable(graph),
    '## Coverage of mandatory IDs',
    coverageTable(graph, body),
    '## Diagram',
    mermaidDiagram(graph),
    '## Slice → nodes',
    slicesTable(graph),
    '## Node details',
    ...graph.nodes.map(nodeSection),
  ].join('\n\n')}\n`;

// Shape validation

const isString = (value) => typeof value === 'string' && value.length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every((item) => isString(item));
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const sliceShapeErrors = (slice, index) => {
  const where = `slices[${index}]`;
  if (!isObject(slice)) return [`${where} is not an object`];
  const errors = ['id', 'title', 'branch']
    .filter((key) => !isString(slice[key]))
    .map((key) => `${where}.${key} must be a non-empty string`);
  if (slice.pr !== undefined && !Number.isInteger(slice.pr)) {
    errors.push(`${where}.pr must be an integer`);
  }
  return errors;
};

const importsShapeErrors = (imports, where) => {
  if (!isObject(imports)) return [`${where}.imports must be an object`];
  return Object.entries(imports)
    .filter(
      ([, entry]) =>
        !isObject(entry) ||
        !Array.isArray(entry.internal) ||
        !Array.isArray(entry.external) ||
        ![...entry.internal, ...entry.external].every(isString),
    )
    .map(
      ([file]) => `${where}.imports["${file}"] must be { internal: string[], external: string[] }`,
    );
};

const nodeShapeErrors = (node, index) => {
  const where = `nodes[${index}]`;
  if (!isObject(node)) return [`${where} is not an object`];
  const errors = [
    ...['id', 'name', 'description', 'slice', 'status', 'verify']
      .filter((key) => !isString(node[key]))
      .map((key) => `${where}.${key} must be a non-empty string`),
    ...['canon', 'dependsOn', 'files']
      .filter((key) => !isStringArray(node[key]))
      .map((key) => `${where}.${key} must be an array of strings`),
    ...importsShapeErrors(node.imports, where),
  ];
  if (isString(node.id) && !/^F-\d{2,}$/.test(node.id)) {
    errors.push(`${where}.id "${node.id}" does not match F-<nn>`);
  }
  return errors;
};

const graphShapeErrors = (graph) => {
  if (!isObject(graph)) return ['root is not an object'];
  const errors = [];
  if (graph.version !== 1) errors.push('version must be 1');
  if (!Array.isArray(graph.slices)) errors.push('slices must be an array');
  else errors.push(...graph.slices.flatMap(sliceShapeErrors));
  if (!Array.isArray(graph.nodes)) errors.push('nodes must be an array');
  else errors.push(...graph.nodes.flatMap(nodeShapeErrors));
  if (errors.length > 0) return errors;
  const duplicates = (ids) => ids.filter((id, i) => ids.indexOf(id) !== i);
  const duplicateNodes = duplicates(graph.nodes.map((node) => node.id));
  const duplicateSlices = duplicates(graph.slices.map((slice) => slice.id));
  if (duplicateNodes.length > 0) errors.push(`duplicate node ids: ${duplicateNodes.join(', ')}`);
  if (duplicateSlices.length > 0) errors.push(`duplicate slice ids: ${duplicateSlices.join(', ')}`);
  return errors;
};

// Invariant checks: each returns a list of problems; empty means ok.

const coverageProblems = (graph, body) => {
  const covered = new Set(graph.nodes.flatMap((node) => node.canon));
  return findIds(body, 'CQD').filter((id) => !covered.has(id));
};

const unknownCanonProblems = (graph, body) => {
  const known = new Set(findIds(body, 'CQSDXPA'));
  return sortedUnique(
    graph.nodes.flatMap((node) => node.canon).filter((id) => !known.has(id)),
    compareIds,
  );
};

const emptyCanonProblems = (graph) =>
  graph.nodes.filter((node) => node.canon.length === 0).map((node) => node.id);

const missingDependencyProblems = (graph) => {
  const known = new Set(graph.nodes.map((node) => node.id));
  return graph.nodes.flatMap((node) =>
    node.dependsOn.filter((dep) => !known.has(dep)).map((dep) => `${node.id} -> ${dep}`),
  );
};

const cycleProblems = (graph) => {
  const depsByNode = new Map(graph.nodes.map((node) => [node.id, node.dependsOn]));
  const state = new Map();
  const cycles = [];
  const visit = (id, stack) => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of depsByNode.get(id) ?? []) {
      if (!depsByNode.has(dep)) continue;
      if (state.get(dep) === 'visiting') {
        cycles.push([...stack.slice(stack.indexOf(dep)), dep].join(' -> '));
      } else if (!state.has(dep)) {
        visit(dep, stack);
      }
    }
    stack.pop();
    state.set(id, 'done');
  };
  for (const node of graph.nodes) {
    if (!state.has(node.id)) visit(node.id, []);
  }
  return cycles;
};

const statusProblems = (graph) =>
  graph.nodes
    .filter((node) => !STATUSES.includes(node.status))
    .map((node) => `${node.id}=${node.status}`);

// A node in progress or done needs done dependencies; a node in review accepts review or done.
const gatingProblems = (graph) => {
  const statusById = new Map(graph.nodes.map((node) => [node.id, node.status]));
  return graph.nodes.flatMap((node) => {
    if (!['in-progress', 'review', 'done'].includes(node.status)) return [];
    return node.dependsOn
      .filter((dep) => statusById.has(dep))
      .filter((dep) => {
        const depStatus = statusById.get(dep);
        return node.status === 'review'
          ? depStatus !== 'review' && depStatus !== 'done'
          : depStatus !== 'done';
      })
      .map((dep) => `${node.id} (${node.status}) depends on ${dep} (${statusById.get(dep)})`);
  });
};

const nodeFiles = (graph) => graph.nodes.flatMap((node) => node.files);

const missingFileProblems = (graph) =>
  graph.nodes.flatMap((node) =>
    node.files
      .filter((file) => !isFile(file) && !isSkippedViewerPath(file))
      .map((file) => `${node.id}: ${file}`),
  );

const skippedLabel = (skipped) => (skipped === 0 ? '' : ` (${skipped} skipped: ${VIEWER_HINT})`);

const plannedWithFilesProblems = (graph) =>
  graph.nodes
    .filter((node) => node.status === 'planned' && node.files.length > 0)
    .map((node) => node.id);

const unknownSliceProblems = (graph) => {
  const known = new Set(graph.slices.map((slice) => slice.id));
  return graph.nodes
    .filter((node) => !known.has(node.slice))
    .map((node) => `${node.id}: ${node.slice}`);
};

const unresolvedImportProblems = (normalised) =>
  normalised.nodes.flatMap((node) =>
    Object.entries(node.imports).flatMap(([file, { internal }]) =>
      internal
        .filter((target) => !isFile(target) && !isSkippedViewerPath(target))
        .map((target) => `${file} -> ${target}`),
    ),
  );

const staleImportProblems = (graph, normalised) =>
  normalised.nodes
    .filter((node) => {
      const stored = graph.nodes.find((candidate) => candidate.id === node.id);
      return JSON.stringify(stored.imports) !== JSON.stringify(node.imports);
    })
    .map((node) => node.id);

const runCheck = () => {
  const results = [];
  const record = (label, problems) => {
    results.push({ ok: problems.length === 0, label, problems });
  };

  let graph;
  try {
    graph = JSON.parse(readText(GRAPH_JSON));
  } catch (error) {
    record(`${GRAPH_JSON} parses as JSON`, [error.message]);
  }
  if (graph !== undefined)
    record(`${GRAPH_JSON} matches the expected shape`, graphShapeErrors(graph));

  if (results.every((result) => result.ok)) {
    const body = canonBody();
    record('Coverage: every mandatory C-/Q-/D- canon ID is covered', coverageProblems(graph, body));
    record('Unknown IDs: every referenced canon ID exists', unknownCanonProblems(graph, body));
    record('Non-empty canon: every node lists a canon ID', emptyCanonProblems(graph));
    record('Dependencies exist', missingDependencyProblems(graph));
    record('No cycles', cycleProblems(graph));
    record('Status values are recognised', statusProblems(graph));
    record('Dependency gating', gatingProblems(graph));
    record('Slices exist for every node', unknownSliceProblems(graph));
    const skippedFiles = nodeFiles(graph).filter(isSkippedViewerPath).length;
    record(`Files exist${skippedLabel(skippedFiles)}`, missingFileProblems(graph));
    record('Planned nodes list no files', plannedWithFilesProblems(graph));

    const normalised = normaliseGraph(graph);
    record('Internal imports resolve to files', unresolvedImportProblems(normalised));
    record('Imports are fresh (run npm run graph:build)', staleImportProblems(graph, normalised));
    const jsonExpected = formatLikeFile(serialiseGraph(normalised), GRAPH_JSON);
    record(
      `${GRAPH_JSON} is normalised (run npm run graph:build)`,
      readText(GRAPH_JSON) === jsonExpected ? [] : ['differs from the normalised form'],
    );
    const mdExpected = formatLikeFile(generateMarkdown(normalised, body), GRAPH_MD);
    record(
      `${GRAPH_MD} is fresh (run npm run graph:build)`,
      readText(GRAPH_MD) === mdExpected ? [] : ['differs from the generated output'],
    );
  }

  for (const { ok, label, problems } of results) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `: ${problems.join('; ')}`}`);
  }
  const failures = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  process.exit(failures === 0 ? 0 : 1);
};

const runBuild = () => {
  const graph = JSON.parse(readText(GRAPH_JSON));
  const normalised = normaliseGraph(graph);
  writeFileSync(join(ROOT, GRAPH_JSON), serialiseGraph(normalised));
  writeFileSync(join(ROOT, GRAPH_MD), generateMarkdown(normalised, canonBody()));
  runPrettier(['--write', GRAPH_JSON, GRAPH_MD]);
  const files = normalised.nodes.reduce((sum, node) => sum + node.files.length, 0);
  console.log(
    `nodes: ${normalised.nodes.length}, slices: ${normalised.slices.length}, files: ${files}`,
  );
  console.log(`written: ${GRAPH_JSON}, ${GRAPH_MD}`);
};

const COMMANDS = { build: runBuild, check: runCheck };
const command = COMMANDS[process.argv[2]];
if (command === undefined) {
  console.error('Usage: node scripts/graph.mjs build | check');
  process.exit(2);
}
command();

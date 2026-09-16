#!/usr/bin/env node
// check-graph.mjs
//
// Purpose: verify that docs/FEATURE-GRAPH.md stays consistent with docs/CANON.md and with
// itself, per the invariants listed in CLAUDE.md section 2 ("Feature graph").
//
// Input file formats this script parses:
//
//   docs/CANON.md
//     A markdown document containing requirement IDs of the form `C-4.3.5`, `Q-1`, `S-5.1`,
//     `D-8`, `X-2`, `P-7`, plus a "Decisions on ambiguities" table with rows shaped like
//     `| A-1 | 2026-09-16 | decision text | rationale | status |`. Everything from the
//     `## Appendix A` heading onward is the verbatim source text of the assignment and is
//     ignored: it is not a source of requirement IDs, it just happens to repeat them in prose.
//
//   docs/FEATURE-GRAPH.md
//     A markdown table under a `## Nodes` heading with columns
//     `| Node | Name | Canon | Depends on | Slice | Status | Verify |`, where `Node` values look
//     like `F-00`, `Canon` is a comma-separated list of canon IDs (occasionally a range written
//     as `A-1..A-5`), and `Depends on` is a comma-separated list of `Node` values or `—` for
//     none. Below that is a ```mermaid block declaring node labels (`F00[F-00 Canon and graph]`)
//     and edges, possibly written as chains (`F08 --> F09 --> F10`).
//
// Usage: node scripts/check-graph.mjs [--root <dir>]
// Exit code: 0 if every check passes, 1 if any check fails.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1] !== undefined) {
      root = argv[i + 1];
      i += 1;
    }
  }
  return { root };
}

// ---------------------------------------------------------------------------
// Canon parsing
// ---------------------------------------------------------------------------

// Matches the exact "## Appendix A" heading that marks the start of the verbatim source text.
const APPENDIX_HEADING_RE = /^## Appendix A/m;

function loadCanonBody(canonText) {
  const match = APPENDIX_HEADING_RE.exec(canonText);
  return match ? canonText.slice(0, match.index) : canonText;
}

// Matches a requirement ID of a given class, e.g. "C-4.3.5", "Q-1", "A-1". The class letter is
// supplied by the caller as part of the character class so the same helper serves every check.
function makeIdRegex(classLetters) {
  return new RegExp(`\\b([${classLetters}])-(\\d+(?:\\.\\d+)*)\\b`, 'g');
}

function findIds(text, classLetters) {
  const re = makeIdRegex(classLetters);
  const ids = new Set();
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = re.exec(text)) !== null) {
    ids.add(`${match[1]}-${match[2]}`);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Feature graph: Nodes table parsing
// ---------------------------------------------------------------------------

// Matches the "## Nodes" heading that introduces the node table.
const NODES_HEADING_RE = /^## Nodes\s*$/m;

// Matches a markdown table separator row such as "|---|---|---|", used to skip it while reading
// the table body.
const TABLE_SEPARATOR_RE = /^\|\s*-{2,}/;

function extractNodesTableLines(graphText) {
  const headingMatch = NODES_HEADING_RE.exec(graphText);
  if (!headingMatch) {
    throw new Error('Could not find "## Nodes" heading in FEATURE-GRAPH.md');
  }
  const afterHeading = graphText.slice(headingMatch.index);
  const lines = afterHeading.split('\n');
  const tableLines = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (trimmed.startsWith('|')) {
        started = true;
      } else {
        continue;
      }
    }
    if (!trimmed.startsWith('|')) {
      break; // table ended
    }
    tableLines.push(trimmed);
  }
  return tableLines;
}

function splitTableRow(line) {
  // A markdown row "| a | b | c |" split into ["a", "b", "c"] by stripping the outer pipes and
  // splitting on the remaining "|" characters. Cell contents in this table never contain a
  // literal pipe character.
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim());
}

// Matches an "A-1..A-5" style range in a Canon cell: same class letter on both ends, plain
// integers only (no sub-numbering), expanded before individual IDs are extracted.
const RANGE_RE = /\b([A-Z])-(\d+)\.\.\1-(\d+)\b/g;

function expandRanges(cellText) {
  return cellText.replace(RANGE_RE, (_wholeMatch, letter, fromStr, toStr) => {
    const from = Number.parseInt(fromStr, 10);
    const to = Number.parseInt(toStr, 10);
    const expanded = [];
    for (let n = from; n <= to; n += 1) {
      expanded.push(`${letter}-${n}`);
    }
    return expanded.join(', ');
  });
}

function extractCanonIdsFromCell(cellText) {
  const expanded = expandRanges(cellText);
  return Array.from(findIds(expanded, 'CQSDXPA'));
}

// Matches a graph node ID such as "F-00" or "F-13".
const NODE_ID_RE = /\bF-\d+\b/g;

function extractNodeIdsFromCell(cellText) {
  const matches = cellText.match(NODE_ID_RE);
  return matches ? Array.from(new Set(matches)) : [];
}

const VALID_STATUSES = new Set(['planned', 'approved', 'in-progress', 'review', 'done']);

function parseNodesTable(graphText) {
  const lines = extractNodesTableLines(graphText);
  const rows = [];
  for (const line of lines) {
    if (TABLE_SEPARATOR_RE.test(line)) continue;
    const cells = splitTableRow(line);
    if (cells.length < 7) continue;
    const [nodeCell, nameCell, canonCell, dependsCell, sliceCell, statusCell] = cells;
    if (nodeCell === 'Node') continue; // header row
    rows.push({
      node: nodeCell,
      name: nameCell,
      canonIds: extractCanonIdsFromCell(canonCell),
      canonCellRaw: canonCell,
      depends: extractNodeIdsFromCell(dependsCell),
      slice: sliceCell,
      status: statusCell.trim(),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Feature graph: mermaid block parsing
// ---------------------------------------------------------------------------

// Matches the fenced ```mermaid ... ``` block.
const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/;

function extractMermaidBlock(graphText) {
  const match = MERMAID_BLOCK_RE.exec(graphText);
  if (!match) {
    throw new Error('Could not find a ```mermaid block in FEATURE-GRAPH.md');
  }
  return match[1];
}

// Matches a node label declaration line, e.g. "  F00[F-00 Canon and graph]", capturing the
// short mermaid id ("F00") and the full node id used in the label text ("F-00").
const LABEL_LINE_RE = /^\s*([A-Za-z0-9_]+)\[(F-\d+)\b/;

function parseMermaidLabels(mermaidText) {
  const labels = new Map(); // short id -> full node id
  for (const line of mermaidText.split('\n')) {
    const match = LABEL_LINE_RE.exec(line);
    if (match) {
      labels.set(match[1], match[2]);
    }
  }
  return labels;
}

function parseMermaidEdges(mermaidText, labels) {
  const edges = new Set();
  for (const line of mermaidText.split('\n')) {
    if (!line.includes('-->')) continue;
    const tokens = line
      .split('-->')
      .map((token) => token.trim())
      // Strip a trailing "[...]" label from a token that both declares and chains, e.g.
      // "F00[F-00 Canon and graph]" appearing as the first element of an edge chain.
      .map((token) => token.replace(/\[.*$/, '').trim())
      .filter((token) => token.length > 0);
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const from = labels.get(tokens[i]) ?? tokens[i];
      const to = labels.get(tokens[i + 1]) ?? tokens[i + 1];
      edges.add(`${from}->${to}`);
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function report(results, ok, message) {
  results.push({ ok, message });
}

function checkCoverage(results, canonBody, rows) {
  const requiredIds = findIds(canonBody, 'CQD');
  const coveredIds = new Set();
  for (const row of rows) {
    for (const id of row.canonIds) coveredIds.add(id);
  }
  const missing = Array.from(requiredIds).filter((id) => !coveredIds.has(id));
  missing.sort();
  if (missing.length === 0) {
    report(results, true, 'Coverage: every C-/Q-/D- canon ID appears in the graph.');
  } else {
    report(results, false, `Coverage: missing canon IDs not present in any node: ${missing.join(', ')}`);
  }
}

function checkUnknownIds(results, canonBody, rows) {
  const knownIds = findIds(canonBody, 'CQSDXPA');
  const unknown = new Set();
  for (const row of rows) {
    for (const id of row.canonIds) {
      if (!knownIds.has(id)) unknown.add(id);
    }
  }
  const list = Array.from(unknown).sort();
  if (list.length === 0) {
    report(results, true, 'Unknown IDs: every canon ID referenced in the graph exists in the canon.');
  } else {
    report(results, false, `Unknown IDs: referenced in the graph but not found in the canon: ${list.join(', ')}`);
  }
}

function checkNonEmptyCanon(results, rows) {
  const empty = rows.filter((row) => row.canonIds.length === 0).map((row) => row.node);
  if (empty.length === 0) {
    report(results, true, 'Non-empty canon: every node row lists at least one canon ID.');
  } else {
    report(results, false, `Non-empty canon: nodes with an empty Canon column: ${empty.join(', ')}`);
  }
}

function checkDependenciesExist(results, rows) {
  const knownNodes = new Set(rows.map((row) => row.node));
  const missing = new Set();
  for (const row of rows) {
    for (const dep of row.depends) {
      if (!knownNodes.has(dep)) missing.add(dep);
    }
  }
  const list = Array.from(missing).sort();
  if (list.length === 0) {
    report(results, true, 'Dependencies exist: every Depends-on value is a known node.');
  } else {
    report(results, false, `Dependencies exist: unknown nodes referenced as dependencies: ${list.join(', ')}`);
  }
}

function checkNoCycles(results, rows) {
  const depsByNode = new Map(rows.map((row) => [row.node, row.depends]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(rows.map((row) => [row.node, WHITE]));
  const cycleNodes = [];

  function visit(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    for (const dep of depsByNode.get(node) ?? []) {
      if (!depsByNode.has(dep)) continue; // reported by checkDependenciesExist
      const depColor = color.get(dep);
      if (depColor === GRAY) {
        cycleNodes.push([...stack.slice(stack.indexOf(dep)), dep].join(' -> '));
      } else if (depColor === WHITE) {
        visit(dep, stack);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  }

  for (const row of rows) {
    if (color.get(row.node) === WHITE) visit(row.node, []);
  }

  if (cycleNodes.length === 0) {
    report(results, true, 'No cycles: the dependency graph is acyclic.');
  } else {
    report(results, false, `No cycles: cycle(s) detected: ${cycleNodes.join(' | ')}`);
  }
}

function tableEdgesFromRows(rows) {
  const edges = new Set();
  for (const row of rows) {
    for (const dep of row.depends) {
      edges.add(`${dep}->${row.node}`);
    }
  }
  return edges;
}

function checkTableDiagramConsistency(results, tableEdges, diagramEdges) {
  const onlyInTable = Array.from(tableEdges).filter((edge) => !diagramEdges.has(edge)).sort();
  const onlyInDiagram = Array.from(diagramEdges).filter((edge) => !tableEdges.has(edge)).sort();
  if (onlyInTable.length === 0 && onlyInDiagram.length === 0) {
    report(results, true, 'Table/diagram consistency: edges match between the table and the mermaid block.');
  } else {
    const parts = [];
    if (onlyInTable.length > 0) parts.push(`only in table: ${onlyInTable.join(', ')}`);
    if (onlyInDiagram.length > 0) parts.push(`only in diagram: ${onlyInDiagram.join(', ')}`);
    report(results, false, `Table/diagram consistency: mismatch (${parts.join('; ')})`);
  }
}

function checkNodeLabelParity(results, rows, labels) {
  const tableNodes = new Set(rows.map((row) => row.node));
  const diagramNodes = new Set(labels.values());
  const onlyInTable = Array.from(tableNodes).filter((n) => !diagramNodes.has(n)).sort();
  const onlyInDiagram = Array.from(diagramNodes).filter((n) => !tableNodes.has(n)).sort();
  if (onlyInTable.length === 0 && onlyInDiagram.length === 0) {
    report(results, true, 'Node/label parity: every table node has a mermaid label and vice versa.');
  } else {
    const parts = [];
    if (onlyInTable.length > 0) parts.push(`table only: ${onlyInTable.join(', ')}`);
    if (onlyInDiagram.length > 0) parts.push(`diagram only: ${onlyInDiagram.join(', ')}`);
    report(results, false, `Node/label parity: mismatch (${parts.join('; ')})`);
  }
}

function checkStatusValues(results, rows) {
  const invalid = rows
    .filter((row) => !VALID_STATUSES.has(row.status))
    .map((row) => `${row.node}=${row.status}`);
  if (invalid.length === 0) {
    report(results, true, 'Status values: every node has a recognised status.');
  } else {
    report(results, false, `Status values: unrecognised status values: ${invalid.join(', ')}`);
  }
}

function checkDependencyGating(results, rows) {
  const statusByNode = new Map(rows.map((row) => [row.node, row.status]));
  const violations = [];
  for (const row of rows) {
    const status = row.status;
    if (status !== 'in-progress' && status !== 'review' && status !== 'done') continue;
    for (const dep of row.depends) {
      const depStatus = statusByNode.get(dep);
      if (depStatus === undefined) continue; // reported by checkDependenciesExist
      const allowed =
        status === 'review' ? depStatus === 'review' || depStatus === 'done' : depStatus === 'done';
      if (!allowed) {
        violations.push(`${row.node} (${status}) depends on ${dep} (${depStatus})`);
      }
    }
  }
  if (violations.length === 0) {
    report(results, true, 'Dependency gating: no node is ahead of a not-yet-ready dependency.');
  } else {
    report(results, false, `Dependency gating: violations: ${violations.join('; ')}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { root } = parseArgs(process.argv.slice(2));

  const canonText = readFileSync(join(root, 'docs/CANON.md'), 'utf8');
  const graphText = readFileSync(join(root, 'docs/FEATURE-GRAPH.md'), 'utf8');

  const canonBody = loadCanonBody(canonText);
  const rows = parseNodesTable(graphText);
  const mermaidText = extractMermaidBlock(graphText);
  const labels = parseMermaidLabels(mermaidText);
  const diagramEdges = parseMermaidEdges(mermaidText, labels);
  const tableEdges = tableEdgesFromRows(rows);

  const results = [];
  checkCoverage(results, canonBody, rows);
  checkUnknownIds(results, canonBody, rows);
  checkNonEmptyCanon(results, rows);
  checkDependenciesExist(results, rows);
  checkNoCycles(results, rows);
  checkTableDiagramConsistency(results, tableEdges, diagramEdges);
  checkNodeLabelParity(results, rows, labels);
  checkStatusValues(results, rows);
  checkDependencyGating(results, rows);

  let failures = 0;
  for (const { ok, message } of results) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
    if (!ok) failures += 1;
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

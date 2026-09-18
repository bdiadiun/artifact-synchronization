#!/usr/bin/env node
// Verifies the postMessage contract copied into the OHIF viewer submodule stays byte-identical
// to packages/contract/src/messages.ts (Q-7); the submodule cannot import outside itself, so the
// contract is duplicated there by hand and this script guards against drift.
//
// The committed hash file next to the copy lets the fork check itself in isolation
// (extensions/scoring-bridge/scripts/check-contract-hash.mjs), so a change made only in the fork
// fails there too (A-12).
//
// Usage: node scripts/check-contract-sync.mjs [--root <dir>] [--write]
// Exit code: 0 when the copy and the hash match (or the submodule is not checked out), 1 otherwise.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const parseArgs = (argv) => {
  let root = process.cwd();
  let isWrite = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1] !== undefined) {
      root = argv[i + 1];
      i += 1;
    }
    if (argv[i] === '--write') {
      isWrite = true;
    }
  }
  return { root, isWrite };
};

const resolvePaths = (root) => ({
  sourcePath: join(root, 'packages', 'contract', 'src', 'messages.ts'),
  copyPath: join(root, 'viewer', 'extensions', 'scoring-bridge', 'src', 'contract', 'messages.ts'),
  hashPath: join(
    root,
    'viewer',
    'extensions',
    'scoring-bridge',
    'src',
    'contract',
    'messages.sha256',
  ),
});

const digestOf = (contents) => createHash('sha256').update(contents).digest('hex');

const checkCopy = (source, copyPath) => {
  if (!existsSync(copyPath)) {
    console.error(`FAIL: viewer copy not found at ${copyPath}`);
    return false;
  }
  if (Buffer.compare(source, readFileSync(copyPath)) === 0) {
    console.log('ok: viewer copy is byte-identical to the contract source');
    return true;
  }
  console.error('FAIL: viewer copy differs from packages/contract/src/messages.ts');
  console.error("hint: run 'npm run contract:sync' to copy the source over the fork file.");
  return false;
};

// The hash is checked against both files: the fork runs the same comparison on its copy alone, so
// a copy that drifts has to fail here too, not only the byte comparison.
const checkHash = (hashPath, files) => {
  if (!existsSync(hashPath)) {
    console.error(`FAIL: hash file not found at ${hashPath}`);
    return false;
  }
  const committed = readFileSync(hashPath, 'utf8').trim();

  return files.reduce((isOk, { label, contents }) => {
    const actual = contents === undefined ? undefined : digestOf(contents);
    if (actual === committed) {
      console.log(`ok: committed hash matches the ${label}`);
      return isOk;
    }
    console.error(
      `FAIL: ${label} hashes to ${actual ?? 'nothing (file missing)'}, committed hash is ${committed}`,
    );
    console.error("hint: run 'npm run contract:sync' to rewrite the copy and the hash file.");
    return false;
  }, true);
};

const sync = (source, { copyPath, hashPath }) => {
  writeFileSync(copyPath, source);
  writeFileSync(hashPath, `${digestOf(source)}\n`);
  console.log(`ok: viewer copy and hash file updated (${digestOf(source)})`);
};

const main = () => {
  const { root, isWrite } = parseArgs(process.argv.slice(2));
  const { sourcePath, copyPath, hashPath } = resolvePaths(root);

  if (!existsSync(sourcePath)) {
    console.error(`FAIL: source of truth not found at ${sourcePath}`);
    process.exit(1);
  }

  // The submodule is optional in a fresh clone; an absent copy is not drift.
  if (!existsSync(dirname(copyPath))) {
    if (isWrite) {
      console.error('FAIL: viewer submodule is not checked out, nothing to sync');
      process.exit(1);
    }
    console.log('skip (viewer copy not present)');
    process.exit(0);
  }

  const source = readFileSync(sourcePath);

  if (isWrite) {
    sync(source, { copyPath, hashPath });
    process.exit(0);
  }

  const isCopyOk = checkCopy(source, copyPath);
  const isHashOk = checkHash(hashPath, [
    { label: 'contract source', contents: source },
    { label: 'viewer copy', contents: existsSync(copyPath) ? readFileSync(copyPath) : undefined },
  ]);
  process.exit(isCopyOk && isHashOk ? 0 : 1);
};

main();

#!/usr/bin/env node
// Verifies the postMessage contract copied into the OHIF viewer submodule stays byte-identical
// to packages/contract/src/messages.ts (Q-7); the submodule cannot import outside itself, so the
// contract is duplicated there by hand and this script guards against drift.
//
// Usage: node scripts/check-contract-sync.mjs [--root <dir>]
// Exit code: 0 when the copy matches (or is not present yet), 1 when it differs.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const parseArgs = (argv) => {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1] !== undefined) {
      root = argv[i + 1];
      i += 1;
    }
  }
  return { root };
};

const main = () => {
  const { root } = parseArgs(process.argv.slice(2));
  const sourcePath = join(root, 'packages', 'contract', 'src', 'messages.ts');
  const copyPath = join(
    root,
    'viewer',
    'extensions',
    'scoring-bridge',
    'src',
    'contract',
    'messages.ts',
  );

  if (!existsSync(sourcePath)) {
    console.error(`FAIL: source of truth not found at ${sourcePath}`);
    process.exit(1);
  }

  if (!existsSync(copyPath)) {
    console.log('skip (viewer copy not present)');
    process.exit(0);
  }

  const source = readFileSync(sourcePath);
  const copy = readFileSync(copyPath);

  if (Buffer.compare(source, copy) === 0) {
    console.log('ok');
    process.exit(0);
  }

  console.error(
    'FAIL: viewer/extensions/scoring-bridge/src/contract/messages.ts is out of sync with packages/contract/src/messages.ts',
  );
  console.error('hint: copy packages/contract/src/messages.ts over the viewer file verbatim.');
  process.exit(1);
};

main();

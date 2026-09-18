#!/usr/bin/env node
// PostToolUse hook: formats the file Claude just wrote, so `npm run format:check` does not fail on
// whitespace later. Reads the hook payload from stdin; if it cannot find a path it exits quietly,
// because a hook must never block an edit.
import { execFileSync } from 'node:child_process';

const FORMATTABLE = /\.(ts|tsx|js|mjs|cjs|json|md|yml|yaml|css|html)$/;

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const pathsFrom = (payload) => {
  const input = payload?.tool_input ?? {};
  const candidates = [input.file_path, input.path, input.notebook_path];
  return candidates.filter((value) => typeof value === 'string' && FORMATTABLE.test(value));
};

const main = async () => {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    process.exit(0);
  }
  for (const file of pathsFrom(payload)) {
    try {
      execFileSync('npx', ['--no-install', 'prettier', '--write', '--ignore-unknown', file], {
        stdio: 'ignore',
      });
    } catch {
      // A file Prettier cannot parse is the developer's problem to see in `format:check`,
      // not a reason to fail the edit.
    }
  }
};

await main();

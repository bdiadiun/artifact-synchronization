#!/usr/bin/env node
// The OHIF fork is a local checkout, not part of this repository (decision A-18). viewer.json pins
// the repository, the branch and the exact commit a reviewer must run; the folder itself is ignored.
//
// Usage: node scripts/viewer.mjs setup | dev | require | link | unlink

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FILE = 'viewer.json';
const SETUP_HINT = 'Run `npm run viewer:setup` to clone it.';

// A-2: the form's origin. The bridge is a published package that carries no deployment URL, so the
// origin reaches it through `window.config`, which OHIF builds from the app config file named by
// APP_CONFIG. The generated file stays untracked in the fork, whose diff is two registration lines.
const HOST_ORIGIN = process.env.HOST_ORIGIN ?? 'http://localhost:5173';
const BASE_APP_CONFIG = 'config/default.js';
const GENERATED_APP_CONFIG = 'config/scoring.js';
const PUBLIC_DIR = 'platform/app/public';

const pin = JSON.parse(readFileSync(join(ROOT, PIN_FILE), 'utf8'));
const viewerDir = join(ROOT, pin.directory);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const run = (command, args, cwd, env = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.error !== undefined) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0)
    fail(`\`${command} ${args.join(' ')}\` failed (status ${result.status}).`);
};

const capture = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : undefined;
};

// A folder left behind by a failed clone is not a checkout, so the manifest decides.
const isCheckedOut = () => existsSync(join(viewerDir, 'package.json'));

const requireCheckout = () => {
  if (isCheckedOut()) return;
  fail(`The OHIF fork is not checked out at ${pin.directory}/. ${SETUP_HINT}`);
};

const cloneViewer = () => {
  console.log(`Cloning ${pin.repository} (branch ${pin.branch}) into ${pin.directory}/ ...`);
  run('git', ['clone', '--branch', pin.branch, pin.repository, viewerDir], ROOT);
  console.log(`Checking out the pinned commit ${pin.commit}.`);
  run('git', ['checkout', '--detach', pin.commit], viewerDir);
};

const reportCommit = () => {
  const head = capture('git', ['rev-parse', 'HEAD'], viewerDir);
  if (head === pin.commit) return;
  console.warn(
    `Warning: ${pin.directory}/ is at ${head ?? 'an unknown commit'}, not the pinned ${pin.commit}.`,
  );
};

const installViewer = () => {
  if (existsSync(join(viewerDir, 'node_modules'))) {
    console.log(`Dependencies are present; remove ${pin.directory}/node_modules to reinstall.`);
    return;
  }
  console.log("Installing the fork's dependencies with its own yarn ...");
  run('yarn', ['install'], viewerDir);
};

const runSetup = () => {
  if (isCheckedOut()) {
    console.log(`${pin.directory}/ is already there; keeping it as it is.`);
    reportCommit();
  } else {
    cloneViewer();
  }
  installViewer();
  console.log('Ready. Start the viewer with `npm run viewer:dev`.');
};

const writeAppConfig = () => {
  const base = readFileSync(join(viewerDir, PUBLIC_DIR, BASE_APP_CONFIG), 'utf8');
  const generated = `${base}\nwindow.config.scoringBridge = { hostOrigin: ${JSON.stringify(HOST_ORIGIN)} };\n`;
  writeFileSync(join(viewerDir, PUBLIC_DIR, GENERATED_APP_CONFIG), generated);
  console.log(`Viewer configured to talk to ${HOST_ORIGIN} (${GENERATED_APP_CONFIG}).`);
};

const runDev = () => {
  requireCheckout();
  writeAppConfig();
  run('yarn', ['--cwd', 'platform/app', 'dev'], viewerDir, {
    OHIF_OPEN: 'false',
    APP_CONFIG: GENERATED_APP_CONFIG,
  });
};

// The fork consumes our packages from the registry. For a browser run of the working tree, the
// four installed copies are swapped for symlinks to `packages/*` (built output included); the
// fork's webpack follows symlinks and still resolves every dependency from its own node_modules,
// so cornerstone stays a single instance. `unlink` puts the installed copies back.
const LINKED_PACKAGES = {
  'scoring-contract': 'contract',
  'scoring-channel': 'channel',
  'ohif-extension-scoring-bridge': 'viewer-bridge',
  'ohif-extension-scoring-adapter': 'viewer-adapter',
};
const SCOPE_DIR = 'node_modules/@bdiadiun';
const KEEP_SUFFIX = '.installed';
// A linked package resolves `react` from its real path, i.e. from this repository's root, which
// would put a second React into the viewer; these links make it find the viewer's own copy.
const PEERS_FROM_VIEWER = ['react', 'react-dom'];

const linkPeers = (folder) => {
  const packageModules = join(ROOT, 'packages', folder, 'node_modules');
  mkdirSync(packageModules, { recursive: true });
  for (const peer of PEERS_FROM_VIEWER) {
    const target = join(packageModules, peer);
    if (!lstatSync(target, { throwIfNoEntry: false })) {
      symlinkSync(join(viewerDir, 'node_modules', peer), target);
    }
  }
};

const unlinkPeers = (folder) => {
  for (const peer of PEERS_FROM_VIEWER) {
    const target = join(ROOT, 'packages', folder, 'node_modules', peer);
    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
      rmSync(target);
    }
  }
};

const runLink = () => {
  requireCheckout();
  run('npm', ['run', 'build', '--workspaces', '--if-present'], ROOT);
  for (const [name, folder] of Object.entries(LINKED_PACKAGES)) {
    const target = join(viewerDir, SCOPE_DIR, name);
    if (lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
      continue;
    }
    if (existsSync(target)) {
      renameSync(target, `${target}${KEEP_SUFFIX}`);
    }
    symlinkSync(join(ROOT, 'packages', folder), target);
    linkPeers(folder);
    console.log(`${name} -> packages/${folder}`);
  }
  console.log('Linked. Run `npm run viewer:unlink` before pinning a release.');
};

const runUnlink = () => {
  requireCheckout();
  for (const [name, folder] of Object.entries(LINKED_PACKAGES)) {
    unlinkPeers(folder);
    const target = join(viewerDir, SCOPE_DIR, name);
    if (!lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
      continue;
    }
    rmSync(target);
    renameSync(`${target}${KEEP_SUFFIX}`, target);
    console.log(`${name} restored`);
  }
};

const COMMANDS = {
  setup: runSetup,
  dev: runDev,
  require: requireCheckout,
  link: runLink,
  unlink: runUnlink,
};
const command = COMMANDS[process.argv[2]];
if (command === undefined) {
  console.error('Usage: node scripts/viewer.mjs setup | dev | require | link | unlink');
  process.exit(2);
}
command();

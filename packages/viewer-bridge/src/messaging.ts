// The viewer end of the channel (A-21): the origin check, the contract guard and the explicit target
// origin all come from `@bdiadiun/scoring-channel`, so both ends share one implementation of them.

import { isHostCommand } from '@bdiadiun/scoring-contract';
import { createIncomingMessages, createPeerPost } from '@bdiadiun/scoring-channel';

import { LOG_PREFIX } from './config.js';
import type { CommandListener, CommandListenerDeps, PostToHost } from './messaging.props.js';

// The host is the window embedding the viewer; a viewer opened directly has nobody to answer.
const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

export const createPostToHost = (hostOrigin: string): PostToHost =>
  createPeerPost({ peerOrigin: hostOrigin, getPeerWindow: getHostWindow, logPrefix: LOG_PREFIX });

// Every command goes to the registry, which owns the per-type dispatch and its exhaustiveness.
export const createCommandListener = ({
  hostOrigin,
  onCommand,
}: CommandListenerDeps): CommandListener =>
  createIncomingMessages({
    peerOrigin: hostOrigin,
    isIncoming: isHostCommand,
    onMessage: onCommand,
    logPrefix: LOG_PREFIX,
  });

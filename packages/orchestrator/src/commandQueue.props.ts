import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { PeerPost } from '@bdiadiun/scoring-channel';

export interface CommandQueueOptions {
  post: PeerPost;
}

export interface CommandQueue {
  push: (command: HostCommand) => void;
  flush: () => void;
  clear: () => void;
  size: () => number;
}

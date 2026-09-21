import type { HostCommand } from '@bdiadiun/scoring-contract';

export interface CommandQueueOptions {
  getViewerWindow: () => Window | null;
  viewerOrigin: string;
}

export interface CommandQueue {
  push: (command: HostCommand) => void;
  flush: () => void;
  clear: () => void;
  size: () => number;
}

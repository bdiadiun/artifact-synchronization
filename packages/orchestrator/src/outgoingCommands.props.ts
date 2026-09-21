import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { PeerPost } from '@bdiadiun/scoring-channel';

export type SendDeactivate = (rowId: string) => void;

export interface ArmedTool {
  remember: (command: HostCommand) => void;
  disarm: (sendDeactivate: SendDeactivate) => void;
}

export interface CommandQueueOptions {
  post: PeerPost;
}

export interface CommandQueue {
  push: (command: HostCommand) => void;
  flush: () => void;
  clear: () => void;
  size: () => number;
}

export interface CommandDeliveryDeps {
  post: PeerPost;
  queue: CommandQueue;
  isReady: () => boolean;
  remember: (command: HostCommand) => void;
  onQueueChange: () => void;
}

export type CommandDelivery = (command: HostCommand) => boolean;

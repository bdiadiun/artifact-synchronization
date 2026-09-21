import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { PeerPost } from '@bdiadiun/scoring-channel';
import type { CommandQueue } from './commandQueue.props';

export interface CommandDeliveryDeps {
  post: PeerPost;
  queue: CommandQueue;
  isReady: () => boolean;
  remember: (command: HostCommand) => void;
  onQueueChange: () => void;
}

export type CommandDelivery = (command: HostCommand) => boolean;

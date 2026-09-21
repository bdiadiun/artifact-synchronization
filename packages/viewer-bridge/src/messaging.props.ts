import type { HostCommand, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Disposable } from '@bdiadiun/scoring-channel';

export type PostToHost = (message: ViewerEvent) => boolean;

export interface CommandListenerDeps {
  hostOrigin: string;
  onCommand: (command: HostCommand) => void;
}

export type CommandListener = Disposable;

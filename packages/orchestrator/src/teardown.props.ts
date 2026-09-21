import type { ArmedTool } from './armedTool.props';
import type { CommandQueue } from './commandQueue.props';
import type { HostChannel } from './createOrchestrator.props';
import type { ListenerSet } from './listeners.props';
import type { StateStore } from './orchestratorState.props';

export interface TeardownDeps {
  store: StateStore;
  channel: HostChannel;
  queue: CommandQueue;
  listeners: ListenerSet;
  armedTool: ArmedTool;
}

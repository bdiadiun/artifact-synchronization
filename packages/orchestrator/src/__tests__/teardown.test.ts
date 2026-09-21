import { describe, expect, it, vi } from 'vitest';

import { createTeardown } from '../teardown';
import type { TeardownDeps } from '../teardown';
import { INITIAL_ORCHESTRATOR_STATE } from '../orchestratorState';
import type { ListenerSet, StateStore } from '../orchestratorState';
import type { HostChannel } from '../createOrchestrator.props';
import type { ArmedTool, CommandQueue } from '../outgoingCommands.props';

const createDeps = (order: string[]): TeardownDeps => {
  const store = {
    get: vi.fn(() => ({ ...INITIAL_ORCHESTRATOR_STATE, ready: true })),
    patch: vi.fn(),
    notify: vi.fn(),
  } as unknown as StateStore;

  const channel = {
    dispose: vi.fn(() => order.push('channel.dispose')),
  } as unknown as HostChannel;

  const queue = {
    clear: vi.fn(() => order.push('queue.clear')),
  } as unknown as CommandQueue;

  const listeners = {
    subscribe: vi.fn(() => () => undefined),
    notify: vi.fn(),
    clear: vi.fn(() => order.push('listeners.clear')),
  } satisfies ListenerSet;

  const armedTool = {
    disarm: vi.fn(() => order.push('armedTool.disarm')),
  } as unknown as ArmedTool;

  return { store, channel, queue, listeners, armedTool };
};

describe('createTeardown', () => {
  it('cancels the armed tool while the channel is still live, not after it is disposed', () => {
    const order: string[] = [];
    const dispose = createTeardown(createDeps(order));

    dispose();

    expect(order.indexOf('armedTool.disarm')).toBeLessThan(order.indexOf('channel.dispose'));
  });

  it('skips cancelling the armed tool when the viewer never became ready', () => {
    const order: string[] = [];
    const deps = createDeps(order);
    (deps.store.get as ReturnType<typeof vi.fn>).mockReturnValue(INITIAL_ORCHESTRATOR_STATE);

    createTeardown(deps)();

    expect(deps.armedTool.disarm).not.toHaveBeenCalled();
    expect(deps.channel.dispose).toHaveBeenCalledTimes(1);
  });
});

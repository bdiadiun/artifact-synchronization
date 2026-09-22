import { ANSWER_TYPE_BY_COMMAND, isHostCommand } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  ArmedRow,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import { INITIAL_CHANNEL_STATE } from './channelState.js';
import type { ChannelState } from './channelState.js';
import type { MessageHandlers } from './messageHandlers.js';
import { listenFrom, postTo } from './peer.js';
import type { Peer } from './peer.js';

export type ViewerPayload<TType extends ViewerEvent['type']> = Omit<
  Extract<ViewerEvent, { type: TType }>,
  'type'
>;

type AnsweredCommand = Extract<HostCommand, { type: AnsweredCommandType }>;

type AnswerPayload<TCommand extends AnsweredCommand> = Omit<
  ViewerPayload<AnswerTypeOf<TCommand['type']>>,
  'causedBy'
>;

type CommandHandler = (command: HostCommand) => void;
type CommandHandlers = Map<HostCommand['type'], Set<CommandHandler>>;

export interface ViewerChannel {
  send: <TType extends ViewerEvent['type']>(type: TType, payload: ViewerPayload<TType>) => boolean;
  on: <TType extends HostCommand['type']>(
    type: TType,
    handler: (command: Extract<HostCommand, { type: TType }>) => void,
  ) => () => void;
  onEach: (handlers: Partial<MessageHandlers<HostCommand>>) => () => void;
  announceReady: (payload: ViewerPayload<'VIEWER_READY'>) => boolean;
  getArmed: () => ArmedRow | null;
  reply: <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ) => boolean;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export interface ViewerChannelOptions {
  hostOrigin: string;
}

const ANNOUNCED_CHANNEL_STATE: ChannelState = { ready: true, queued: 0 };

const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

const addHandler = (
  handlers: CommandHandlers,
  type: HostCommand['type'],
  handler: CommandHandler,
): (() => void) => {
  const forType = handlers.get(type) ?? new Set<CommandHandler>();
  handlers.set(type, forType);
  forType.add(handler);

  return () => {
    forType.delete(handler);
  };
};

const addEachHandler = (
  handlers: CommandHandlers,
  commandHandlers: Partial<MessageHandlers<HostCommand>>,
): (() => void) => {
  const unsubscribes = Object.entries(commandHandlers).map(([type, handler]) =>
    addHandler(handlers, type as HostCommand['type'], handler as CommandHandler),
  );

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
};

const dispatch = (handlers: CommandHandlers, command: HostCommand): void => {
  for (const handler of handlers.get(command.type) ?? []) {
    handler(command);
  }
};

const notifyAll = (listeners: Set<() => void>): void => {
  for (const listener of listeners) {
    listener();
  }
};

const addListener = (listeners: Set<() => void>, listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const createViewerChannel = ({ hostOrigin }: ViewerChannelOptions): ViewerChannel => {
  const peer: Peer = { origin: hostOrigin, getWindow: getHostWindow };
  const handlers: CommandHandlers = new Map();
  const listeners = new Set<() => void>();
  let armed: ArmedRow | null = null;
  let announced = false;

  const post = (type: ViewerEvent['type'], payload: object): boolean => {
    const event = { type, ...payload } as ViewerEvent;

    if (!postTo(peer, event)) {
      return false;
    }
    if (event.type === 'VIEWER_READY' && !announced) {
      announced = true;
      notifyAll(listeners);
    }
    if (event.type === 'MEASUREMENT_ADDED' && event.rowId === (armed?.rowId ?? null)) {
      armed = null;
    }
    return true;
  };

  const send = <TType extends ViewerEvent['type']>(
    type: TType,
    payload: ViewerPayload<TType>,
  ): boolean => post(type, payload);

  const on = <TType extends HostCommand['type']>(
    type: TType,
    handler: (command: Extract<HostCommand, { type: TType }>) => void,
  ): (() => void) => addHandler(handlers, type, handler as CommandHandler);

  const onEach = (commandHandlers: Partial<MessageHandlers<HostCommand>>): (() => void) =>
    addEachHandler(handlers, commandHandlers);

  const announceReady = (payload: ViewerPayload<'VIEWER_READY'>): boolean =>
    announced || post('VIEWER_READY', payload);

  const getArmed = (): ArmedRow | null => armed;

  const reply = <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ): boolean =>
    post(ANSWER_TYPE_BY_COMMAND[command.type], { ...payload, causedBy: command.requestId });

  const getState = (): ChannelState =>
    announced ? ANNOUNCED_CHANNEL_STATE : INITIAL_CHANNEL_STATE;

  const subscribe = (listener: () => void): (() => void) => addListener(listeners, listener);

  const handleCommand = (command: HostCommand): void => {
    if (command.type === 'ACTIVATE_TOOL') {
      armed = { rowId: command.rowId, requestId: command.requestId };
    }
    if (command.type === 'DEACTIVATE_TOOL' && armed?.rowId === command.rowId) {
      armed = null;
    }
    dispatch(handlers, command);
  };

  const stopListening = listenFrom(peer, isHostCommand, handleCommand);

  const dispose = (): void => {
    armed = null;
    announced = false;
    stopListening();
    handlers.clear();
    listeners.clear();
  };

  return { send, on, onEach, announceReady, getArmed, reply, getState, subscribe, dispose };
};

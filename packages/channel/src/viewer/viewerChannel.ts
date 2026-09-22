import { ANSWER_TYPE_BY_COMMAND, isHostCommand } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import type { MessageHandlers, PayloadOf } from '../shared/channelApi.js';
import { listenFrom, postTo } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';

export interface ArmedRow {
  rowId: string;
  requestId: string;
}

export type ViewerPayload<TType extends ViewerEvent['type']> = PayloadOf<ViewerEvent, TType>;

type AnsweredCommand = Extract<HostCommand, { type: AnsweredCommandType }>;

type AnswerPayload<TCommand extends AnsweredCommand> = Omit<
  ViewerPayload<AnswerTypeOf<TCommand['type']>>,
  'causedBy'
>;

type CommandHandlers = Partial<MessageHandlers<HostCommand>>;

export interface ViewerChannel {
  send: <TType extends ViewerEvent['type']>(type: TType, payload: ViewerPayload<TType>) => boolean;
  onEach: (handlers: CommandHandlers) => () => void;
  announceReady: (payload: ViewerPayload<'VIEWER_READY'>) => boolean;
  getArmed: () => ArmedRow | null;
  reply: <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ) => boolean;
  dispose: () => void;
}

export interface ViewerChannelOptions {
  hostOrigin: string;
}

const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

const callHandler = <TType extends HostCommand['type']>(
  handlers: CommandHandlers,
  type: TType,
  command: Extract<HostCommand, { type: TType }>,
): void => {
  handlers[type]?.(command);
};

const addHandlers = (handlerMaps: CommandHandlers[], handlers: CommandHandlers): (() => void) => {
  handlerMaps.push(handlers);

  return () => {
    const index = handlerMaps.indexOf(handlers);

    if (index !== -1) {
      handlerMaps.splice(index, 1);
    }
  };
};

const dispatch = (handlerMaps: CommandHandlers[], command: HostCommand): void => {
  for (const handlers of handlerMaps) {
    callHandler(handlers, command.type, command);
  }
};

export const createViewerChannel = ({ hostOrigin }: ViewerChannelOptions): ViewerChannel => {
  const peer: Peer = { origin: hostOrigin, getWindow: getHostWindow };
  const handlerMaps: CommandHandlers[] = [];
  let armed: ArmedRow | null = null;
  let announced = false;

  const post = (type: ViewerEvent['type'], payload: object): boolean => {
    const event = { type, ...payload } as ViewerEvent;

    if (!postTo(peer, event)) {
      return false;
    }
    if (event.type === 'VIEWER_READY') {
      announced = true;
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

  const onEach = (handlers: CommandHandlers): (() => void) => addHandlers(handlerMaps, handlers);

  const announceReady = (payload: ViewerPayload<'VIEWER_READY'>): boolean =>
    announced || post('VIEWER_READY', payload);

  const getArmed = (): ArmedRow | null => armed;

  const reply = <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ): boolean =>
    post(ANSWER_TYPE_BY_COMMAND[command.type], { ...payload, causedBy: command.requestId });

  const handleCommand = (command: HostCommand): void => {
    if (command.type === 'ACTIVATE_TOOL') {
      armed = { rowId: command.rowId, requestId: command.requestId };
    }
    if (command.type === 'DEACTIVATE_TOOL' && armed?.rowId === command.rowId) {
      armed = null;
    }
    dispatch(handlerMaps, command);
  };

  const stopListening = listenFrom(peer, isHostCommand, handleCommand);

  const dispose = (): void => {
    armed = null;
    announced = false;
    stopListening();
    handlerMaps.length = 0;
  };

  return { send, onEach, announceReady, getArmed, reply, dispose };
};

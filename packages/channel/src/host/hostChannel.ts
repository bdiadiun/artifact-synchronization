import { ANSWER_TYPE_BY_COMMAND, isViewerEvent } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import type { MessageHandlers, PayloadOf } from '../shared/channelApi.js';
import { listenFrom } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';
import { createHostOutbox } from './outbox.js';
import type { ChannelState, HostOutbox } from './outbox.js';
import { createPendingAnswers } from './pendingAnswers.js';

export type HostPayload<TType extends HostCommand['type']> = Omit<
  PayloadOf<HostCommand, TType>,
  'requestId'
>;

type EventHandlers = Partial<MessageHandlers<ViewerEvent>>;

export interface HostChannel {
  send: <TType extends HostCommand['type']>(type: TType, payload: HostPayload<TType>) => boolean;
  onEach: (handlers: EventHandlers) => () => void;
  exchange: <TType extends HostCommand['type'] & AnsweredCommandType>(
    type: TType,
    payload: HostPayload<TType>,
  ) => Promise<Extract<ViewerEvent, { type: AnswerTypeOf<TType> }>>;
  getState: () => ChannelState;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

export interface HostChannelOptions {
  viewerOrigin: string;
  getViewerWindow: () => Window | null;
}

const callHandler = <TType extends ViewerEvent['type']>(
  handlers: EventHandlers,
  type: TType,
  event: Extract<ViewerEvent, { type: TType }>,
): void => {
  handlers[type]?.(event);
};

const addHandlers = (handlerMaps: EventHandlers[], handlers: EventHandlers): (() => void) => {
  handlerMaps.push(handlers);

  return () => {
    const index = handlerMaps.indexOf(handlers);

    if (index !== -1) {
      handlerMaps.splice(index, 1);
    }
  };
};

const dispatch = (handlerMaps: EventHandlers[], event: ViewerEvent): void => {
  for (const handlers of handlerMaps) {
    callHandler(handlers, event.type, event);
  }
};

const armedRowAfter = (
  type: HostCommand['type'],
  payload: object,
  armedRowId: string | null,
): string | null => {
  if (type !== 'ACTIVATE_TOOL' && type !== 'DEACTIVATE_TOOL') {
    return armedRowId;
  }
  const rowId = 'rowId' in payload ? payload.rowId : null;
  return type === 'ACTIVATE_TOOL' && typeof rowId === 'string' ? rowId : null;
};

const cancelArmedRow = (outbox: HostOutbox, armedRowId: string | null): void => {
  if (armedRowId !== null && outbox.getState().ready) {
    outbox.send('DEACTIVATE_TOOL', { rowId: armedRowId }, crypto.randomUUID());
  }
};

export const createHostChannel = ({
  viewerOrigin,
  getViewerWindow,
}: HostChannelOptions): HostChannel => {
  const peer: Peer = { origin: viewerOrigin, getWindow: getViewerWindow };
  const outbox = createHostOutbox(peer);
  const { getState, subscribe } = outbox;
  const pending = createPendingAnswers();
  const handlerMaps: EventHandlers[] = [];
  let armedRowId: string | null = null;
  let disposed = false;

  const send = <TType extends HostCommand['type']>(
    type: TType,
    payload: HostPayload<TType>,
  ): boolean => {
    if (disposed) {
      return false;
    }
    armedRowId = armedRowAfter(type, payload, armedRowId);
    return outbox.send(type, payload, crypto.randomUUID());
  };

  const onEach = (handlers: EventHandlers): (() => void) => addHandlers(handlerMaps, handlers);

  const exchange = <TType extends HostCommand['type'] & AnsweredCommandType>(
    type: TType,
    payload: HostPayload<TType>,
  ): Promise<Extract<ViewerEvent, { type: AnswerTypeOf<TType> }>> => {
    const requestId = crypto.randomUUID();
    const answer = pending.awaitAnswer(requestId, type, ANSWER_TYPE_BY_COMMAND[type]);

    outbox.send(type, payload, requestId);
    return answer as Promise<Extract<ViewerEvent, { type: AnswerTypeOf<TType> }>>;
  };

  const handleEvent = (event: ViewerEvent): void => {
    if (pending.settle(event)) {
      return;
    }
    if (event.type === 'VIEWER_READY') {
      outbox.flush();
    }
    dispatch(handlerMaps, event);
  };

  const stopListening = listenFrom(peer, isViewerEvent, handleEvent);

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelArmedRow(outbox, armedRowId);
    pending.rejectAll('the channel was disposed before the answer arrived');
    stopListening();
    handlerMaps.length = 0;
    outbox.clear();
  };

  return { send, onEach, exchange, getState, subscribe, dispose };
};

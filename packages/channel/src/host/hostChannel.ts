import { ANSWER_TYPE_BY_COMMAND, isViewerEvent } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import type { ChannelState, MessageHandlers } from '../shared/channelApi.js';
import { listenFrom } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';
import { createHostOutbox } from './outbox.js';
import type { HostOutbox } from './outbox.js';
import { createPendingAnswers } from './pendingAnswers.js';

export type HostPayload<TType extends HostCommand['type']> = Omit<
  Extract<HostCommand, { type: TType }>,
  'type' | 'requestId'
>;

type EventHandler = (event: ViewerEvent) => void;
type EventHandlers = Map<ViewerEvent['type'], Set<EventHandler>>;

export interface HostChannel {
  send: <TType extends HostCommand['type']>(type: TType, payload: HostPayload<TType>) => boolean;
  on: <TType extends ViewerEvent['type']>(
    type: TType,
    handler: (event: Extract<ViewerEvent, { type: TType }>) => void,
  ) => () => void;
  onEach: (handlers: Partial<MessageHandlers<ViewerEvent>>) => () => void;
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

const addHandler = (
  handlers: EventHandlers,
  type: ViewerEvent['type'],
  handler: EventHandler,
): (() => void) => {
  const forType = handlers.get(type) ?? new Set<EventHandler>();
  handlers.set(type, forType);
  forType.add(handler);

  return () => {
    forType.delete(handler);
  };
};

const addEachHandler = (
  handlers: EventHandlers,
  eventHandlers: Partial<MessageHandlers<ViewerEvent>>,
): (() => void) => {
  const unsubscribes = Object.entries(eventHandlers).map(([type, handler]) =>
    addHandler(handlers, type as ViewerEvent['type'], handler as EventHandler),
  );

  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
};

const dispatch = (handlers: EventHandlers, event: ViewerEvent): void => {
  for (const handler of handlers.get(event.type) ?? []) {
    handler(event);
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
  const handlers: EventHandlers = new Map();
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

  const on = <TType extends ViewerEvent['type']>(
    type: TType,
    handler: (event: Extract<ViewerEvent, { type: TType }>) => void,
  ): (() => void) => addHandler(handlers, type, handler as EventHandler);

  const onEach = (eventHandlers: Partial<MessageHandlers<ViewerEvent>>): (() => void) =>
    addEachHandler(handlers, eventHandlers);

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
    dispatch(handlers, event);
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
    handlers.clear();
    outbox.clear();
  };

  return { send, on, onEach, exchange, getState, subscribe, dispose };
};

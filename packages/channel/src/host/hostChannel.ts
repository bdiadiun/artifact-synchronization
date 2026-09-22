import { ANSWER_TYPE_BY_COMMAND, isViewerEvent } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import { listenFrom } from '../shared/peer.js';
import type { Peer } from '../shared/peer.js';
import { createHostOutbox } from './outbox.js';
import type { ChannelState, HostOutbox } from './outbox.js';
import { createPendingAnswers } from './pendingAnswers.js';

export type HostPayload<TType extends HostCommand['type']> = Omit<
  Extract<HostCommand, { type: TType }>,
  'type' | 'requestId'
>;

export interface HostChannel {
  send: (command: HostCommand) => boolean;
  onEvent: (handle: (event: ViewerEvent) => void) => () => void;
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

const ignoreEvent = (): void => undefined;

const toCommand = (type: HostCommand['type'], requestId: string, payload: object): HostCommand =>
  ({ type, requestId, ...payload }) as HostCommand;

const armedRowAfter = (command: HostCommand, armedRowId: string | null): string | null => {
  if (command.type === 'ACTIVATE_TOOL') {
    return command.rowId;
  }
  if (command.type === 'DEACTIVATE_TOOL' && command.rowId === armedRowId) {
    return null;
  }
  return armedRowId;
};

const cancelArmedRow = (outbox: HostOutbox, armedRowId: string | null): void => {
  if (armedRowId !== null && outbox.getState().ready) {
    outbox.send({ type: 'DEACTIVATE_TOOL', requestId: crypto.randomUUID(), rowId: armedRowId });
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
  let handle: (event: ViewerEvent) => void = ignoreEvent;
  let armedRowId: string | null = null;
  let disposed = false;

  const send = (command: HostCommand): boolean => {
    if (disposed) {
      return false;
    }
    armedRowId = armedRowAfter(command, armedRowId);
    return outbox.send(command);
  };

  const onEvent = (next: (event: ViewerEvent) => void): (() => void) => {
    handle = next;

    return () => {
      handle = ignoreEvent;
    };
  };

  const exchange = <TType extends HostCommand['type'] & AnsweredCommandType>(
    type: TType,
    payload: HostPayload<TType>,
  ): Promise<Extract<ViewerEvent, { type: AnswerTypeOf<TType> }>> => {
    const requestId = crypto.randomUUID();
    const answer = pending.awaitAnswer(requestId, type, ANSWER_TYPE_BY_COMMAND[type]);

    outbox.send(toCommand(type, requestId, payload));
    return answer as Promise<Extract<ViewerEvent, { type: AnswerTypeOf<TType> }>>;
  };

  const handleEvent = (event: ViewerEvent): void => {
    if (pending.settle(event)) {
      return;
    }
    if (event.type === 'VIEWER_READY') {
      outbox.flush();
    }
    handle(event);
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
    handle = ignoreEvent;
    outbox.clear();
  };

  return { send, onEvent, exchange, getState, subscribe, dispose };
};

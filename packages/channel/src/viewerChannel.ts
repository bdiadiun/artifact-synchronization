// The viewer end (A-21, A-23): host commands come in, viewer events go out to the window
// embedding the viewer. Everything the conversation itself needs lives here — announcing the
// viewer, the row the host armed, and the answer a command is entitled to — so the extension is
// left with what is about OHIF.

import { ANSWER_TYPE_BY_COMMAND, isHostCommand } from '@bdiadiun/scoring-contract';
import type {
  AnsweredCommandType,
  AnswerTypeOf,
  ArmedRow,
  HostCommand,
  ViewerEvent,
} from '@bdiadiun/scoring-contract';
import type { PayloadOf } from './buildMessage.js';
import { createChannel } from './createChannel.js';
import type { Channel } from './createChannel.js';

// A command an answer exists for. `reply` takes the command itself, so the cause of the answer
// cannot be mistyped at the call site (A-10).
export type AnsweredCommand = Extract<HostCommand, { type: AnsweredCommandType }>;

// The answer's payload minus the cause, which `reply` fills in from the command.
export type AnswerPayload<TCommand extends AnsweredCommand> = Omit<
  PayloadOf<ViewerEvent, AnswerTypeOf<TCommand['type']>>,
  'causedBy'
>;

export interface ViewerChannel extends Channel<HostCommand, ViewerEvent> {
  // Announces the viewer once (Q-1); false while no window is there to receive it, so a caller
  // that is told again tries again.
  announceReady: (payload: PayloadOf<ViewerEvent, 'VIEWER_READY'>) => boolean;
  // The row ACTIVATE_TOOL armed, until it is deactivated or its measurement has been sent (A-8).
  getArmed: () => ArmedRow | null;
  // Sends the event the contract's table pairs with this command, caused by it.
  reply: <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ) => boolean;
}

export interface ViewerChannelOptions {
  hostOrigin: string;
}

// The host is the window embedding the viewer; a viewer opened directly has nobody to answer.
const getHostWindow = (): Window | null => (window.parent === window ? null : window.parent);

// `type` says which event this is, but the compiler keeps the payload union open, so the row is
// read from the payload by name rather than by narrowing.
const rowIdOf = (payload: object): string | null =>
  'rowId' in payload && typeof payload.rowId === 'string' ? payload.rowId : null;

export const createViewerChannel = ({ hostOrigin }: ViewerChannelOptions): ViewerChannel => {
  const channel = createChannel<HostCommand, ViewerEvent>({
    peer: { origin: hostOrigin, getWindow: getHostWindow },
    isIncoming: isHostCommand,
    gate: { opensOn: 'outgoing', type: 'VIEWER_READY' },
  });

  let armed: ArmedRow | null = null;

  channel.on('ACTIVATE_TOOL', ({ rowId, requestId }) => {
    armed = { rowId, requestId };
  });

  channel.on('DEACTIVATE_TOOL', ({ rowId }) => {
    if (armed?.rowId === rowId) {
      armed = null;
    }
  });

  const send: ViewerChannel['send'] = (type, payload) => {
    const sent = channel.send(type, payload);

    // The row stops being armed with the measurement it was armed for (C-4.3.6, A-10).
    if (sent && type === 'MEASUREMENT_ADDED' && rowIdOf(payload) === (armed?.rowId ?? null)) {
      armed = null;
    }

    return sent;
  };

  // The answer type follows from the command through the contract's table, and the payload from
  // the answer type; the generic send cannot carry that correlation, so it is stated once here.
  const deliverAnswer: (type: ViewerEvent['type'], payload: object) => boolean = send;

  const reply = <TCommand extends AnsweredCommand>(
    command: TCommand,
    payload: AnswerPayload<TCommand>,
  ): boolean =>
    deliverAnswer(ANSWER_TYPE_BY_COMMAND[command.type], {
      ...payload,
      causedBy: command.requestId,
    });

  return {
    ...channel,
    send,
    reply,
    getArmed: (): ArmedRow | null => armed,
    announceReady: (payload): boolean => channel.getState().ready || send('VIEWER_READY', payload),

    dispose: (): void => {
      armed = null;
      channel.dispose();
    },
  };
};

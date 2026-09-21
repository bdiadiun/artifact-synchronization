// The message shape, assembled in one place so `version` and the request id never appear at a call
// site (A-21).

import { CONTRACT_VERSION, HOST_COMMAND_TYPES } from '@bdiadiun/scoring-contract';
import type { BridgeMessage } from '@bdiadiun/scoring-contract';
import type { PayloadOf } from './buildMessage.props.js';

// Every host command carries a request id and no viewer event does, so the direction decides it.
export const needsRequestId = (type: string): boolean =>
  (HOST_COMMAND_TYPES as readonly string[]).includes(type);

export const buildMessage = <TOutgoing extends BridgeMessage, TType extends TOutgoing['type']>(
  type: TType,
  payload: PayloadOf<TOutgoing, TType>,
  requestId: string | undefined,
): TOutgoing => {
  const identity = requestId === undefined ? {} : { requestId };

  // Rebuilt from its parts, so the compiler cannot see that this is the union member `type`
  // selects; the payload type is what guarantees the fields.
  return { version: CONTRACT_VERSION, type, ...identity, ...payload } as unknown as TOutgoing;
};

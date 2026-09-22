// Which viewer event answers which host command (A-21). The `satisfies` clause checks both halves
// against the contract: a key that is no host command, or an answer that is no viewer event, fails
// here instead of at the call site that awaits it.

import type { HostCommand } from './hostCommands.props';
import type { ViewerEvent } from './viewerEvents.props';

export const ANSWER_TYPE_BY_COMMAND = {
  REMOVE_MEASUREMENT: 'MEASUREMENT_REMOVED',
  RESTORE_MEASUREMENTS: 'MEASUREMENTS_RESTORED',
} as const satisfies Partial<Record<HostCommand['type'], ViewerEvent['type']>>;

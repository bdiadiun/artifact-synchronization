import type { Dispatch } from 'react';
import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { FormAction, FormState, Row } from './rows';

export interface ViewerEventContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: (command: HostCommand) => void;
  // requestIds of the REMOVE_MEASUREMENT commands `useScoringForm` issued (A-10 echo guard); this
  // module only consumes them.
  issuedRemovalRequestIds: Set<string>;
  // Rows loaded from sessionStorage at mount (A-14); fixed for the session, independent of `state`.
  restoredRows: readonly Row[];
  // requestIds of the RESTORE_MEASUREMENTS commands issued below, matched against
  // MEASUREMENTS_RESTORED the same way `issuedRemovalRequestIds` matches REMOVE_MEASUREMENT.
  issuedRestoreRequestIds: Set<string>;
}

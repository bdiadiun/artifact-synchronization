import type { Dispatch } from 'react';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import type { FormAction, FormState, Row } from './rows';

export interface ViewerEventContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
  // Rows loaded from sessionStorage at mount (A-14); fixed for the session, independent of `state`.
  restoredRows: readonly Row[];
}

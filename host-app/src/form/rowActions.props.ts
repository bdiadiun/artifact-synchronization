import type { Dispatch } from 'react';
import type { HostCommand, ToolName } from '@bdiadiun/scoring-contract';
import type { FormAction, FormState } from './rows';

export interface RowActionsContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: (command: HostCommand) => void;
  // requestIds of REMOVE_MEASUREMENT commands issued here; the incoming handler drops their echo
  // (A-10). Owned by the caller so both halves of the form share the same set.
  issuedRemovalRequestIds: Set<string>;
}

export interface RowActions {
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

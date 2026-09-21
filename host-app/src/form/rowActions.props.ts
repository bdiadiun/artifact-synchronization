import type { Dispatch } from 'react';
import type { ToolName } from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import type { FormAction, FormState } from './rows';

export interface RowActionsContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
}

export interface RowActions {
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

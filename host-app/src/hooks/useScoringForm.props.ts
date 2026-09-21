import type { ToolName, ViewerEvent } from '@bdiadiun/scoring-contract';
import type { HostChannel } from '@bdiadiun/scoring-orchestrator';
import type { Row } from '@app/form/rows';

export interface UseScoringFormOptions {
  send: HostChannel['send'];
  exchange: HostChannel['exchange'];
  lastEvent: ViewerEvent | null;
}

export interface UseScoringFormResult {
  rows: Row[];
  addRow: (toolName?: ToolName) => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
}

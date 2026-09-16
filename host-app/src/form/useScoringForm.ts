// React hook combining the pure row reducer with the bridge (canon C-4.3.1, C-4.3.2, C-4.3.3,
// C-4.3.7, Q-3, decisions A-4, A-8, A-9). Owns row-id issuance (A-8: host issues `rowId`) and the
// host -> viewer half of the activate/cancel flow; the viewer -> host measurement wiring lands in
// a later slice.

import { useEffect, useReducer, useRef } from 'react';
import type { HostCommand, ViewerEvent } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import { initialFormState, reducer, type Row } from './rows';

export interface UseScoringFormOptions {
  send: (command: HostCommand) => void;
  lastEvent: ViewerEvent | null;
}

export interface UseScoringFormResult {
  rows: Row[];
  addRow: () => void;
  activate: (rowId: string) => void;
  cancel: (rowId: string) => void;
}

export function useScoringForm({ send, lastEvent }: UseScoringFormOptions): UseScoringFormResult {
  const [state, dispatch] = useReducer(reducer, initialFormState);

  function addRow(): void {
    // Host issues the row id (A-8): the row must exist, empty, before anything is armed.
    dispatch({ type: 'ADD_ROW', rowId: crypto.randomUUID() });
  }

  function activate(rowId: string): void {
    const previousArmedRowId = state.armedRowId;
    dispatch({ type: 'ARM_ROW', rowId });
    // Only one row can be armed at a time (A-4): tell the viewer to drop the previous one before
    // arming the new one, so the viewer's armed state never disagrees with the form's.
    if (previousArmedRowId !== null && previousArmedRowId !== rowId) {
      send({
        version: 1,
        type: 'DEACTIVATE_TOOL',
        requestId: crypto.randomUUID(),
        rowId: previousArmedRowId,
      });
    }
    send({
      version: 1,
      type: 'ACTIVATE_TOOL',
      requestId: crypto.randomUUID(),
      rowId,
      // Single configurable constant (P-7): a tool swap edits config.ts only.
      toolName: DEFAULT_TOOL,
    });
  }

  function cancel(rowId: string): void {
    dispatch({ type: 'DISARM_ROW', rowId });
    send({ version: 1, type: 'DEACTIVATE_TOOL', requestId: crypto.randomUUID(), rowId });
  }

  // Re-arm on viewer reload (A-9): a second VIEWER_READY means the iframe reloaded, so any
  // command already flushed before the reload is gone from the viewer's memory. If a row is
  // still armed on this side, re-send ACTIVATE_TOOL for it. The first-ever VIEWER_READY does not
  // need this: an activation clicked before that point is still sitting in the bridge's queue and
  // gets flushed automatically.
  const readyCountRef = useRef(0);
  const processedEventRef = useRef<ViewerEvent | null>(null);

  useEffect(() => {
    if (lastEvent === null || lastEvent === processedEventRef.current) {
      return;
    }
    processedEventRef.current = lastEvent;
    if (lastEvent.type !== 'VIEWER_READY') {
      return;
    }
    readyCountRef.current += 1;
    if (readyCountRef.current <= 1 || state.armedRowId === null) {
      return;
    }
    const armedRow = state.rows.find((row) => row.rowId === state.armedRowId);
    if (armedRow === undefined) {
      return;
    }
    send({
      version: 1,
      type: 'ACTIVATE_TOOL',
      requestId: crypto.randomUUID(),
      rowId: armedRow.rowId,
      toolName: armedRow.toolName,
    });
    // No cleanup needed: this effect only reacts to a new `lastEvent` reference and never
    // subscribes to anything itself (the bridge subscription lives in useBridge).
  }, [lastEvent, state.armedRowId, state.rows, send]);

  return { rows: state.rows, addRow, activate, cancel };
}

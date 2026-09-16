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

  // Dedupe: `lastEvent` is a `useState`-style snapshot from the bridge, so a re-render that does
  // not carry a *new* event object must not reprocess the previous one. Compared by identity
  // (not by content) because that is exactly what "a new event arrived" means here.
  const readyCountRef = useRef(0);
  const processedEventRef = useRef<ViewerEvent | null>(null);

  useEffect(() => {
    if (lastEvent === null || lastEvent === processedEventRef.current) {
      return;
    }
    processedEventRef.current = lastEvent;

    // A second READY means the iframe reloaded (A-9): any command already flushed before the
    // reload is gone from the viewer's memory. If a row is still armed on this side, re-send
    // ACTIVATE_TOOL for it. The first-ever VIEWER_READY does not need this: an activation clicked
    // before that point is still sitting in the bridge's queue and gets flushed automatically.
    function processViewerReady(): void {
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
    }

    function processMeasurementAdded(event: Extract<ViewerEvent, { type: 'MEASUREMENT_ADDED' }>): void {
      // A-8: a measurement drawn while nothing is armed (e.g. from the OHIF toolbar) arrives with
      // `rowId: null`. There is nowhere in the form to put it, so it is logged and dropped.
      if (event.rowId === null) {
        console.info('[form] measurement without an armed row ignored', event.measurementUid);
        return;
      }
      const row = state.rows.find((candidate) => candidate.rowId === event.rowId);
      // The reducer already refuses to apply MEASUREMENT_RECEIVED to a missing or non-`drawing`
      // row (defence in depth, see rows.ts), so this branch never changes state either way. It is
      // still checked and logged here so the console shows *where* a stray event was decided to
      // be a no-op, instead of only "nothing happened" from the reducer's silent `return state`.
      if (row === undefined || row.status !== 'drawing') {
        console.warn('[form] measurement for a row that is not armed', event.rowId, event.measurementUid);
        return;
      }
      // No separate `uidToRowId` map kept on the host: the row already carries its own
      // `measurementUid` once done (A-8), and `MEASUREMENT_ADDED` supplies `rowId` directly, so
      // there is nothing this map would resolve that the reducer state does not already have.
      dispatch({
        type: 'MEASUREMENT_RECEIVED',
        rowId: event.rowId,
        measurementUid: event.measurementUid,
        metrics: event.metrics,
      });
    }

    // Single entry point shared by both event types: dedupe above by object identity, branch by
    // `type` here. VIEWER_READY and MEASUREMENT_ADDED used to be handled by separate effects;
    // folded into one so the "is this a new event" check exists exactly once.
    if (lastEvent.type === 'VIEWER_READY') {
      processViewerReady();
    } else if (lastEvent.type === 'MEASUREMENT_ADDED') {
      processMeasurementAdded(lastEvent);
    }
    // No cleanup needed: this effect only reacts to a new `lastEvent` reference and never
    // subscribes to anything itself (the bridge subscription lives in useBridge).
  }, [lastEvent, state.armedRowId, state.rows, send]);

  return { rows: state.rows, addRow, activate, cancel };
}

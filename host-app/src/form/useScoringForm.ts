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
  remove: (rowId: string) => void;
  focus: (rowId: string) => void;
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

  // S-5.2 deletion, host -> viewer direction. Behaviour depends on the row's current status
  // (decided with the author): `done` has a real annotation to remove in the viewer; `drawing`
  // has nothing drawn yet but the tool is armed, so it is cancelled first, same as `cancel`;
  // `pending` has neither, so only the row itself goes away.
  function remove(rowId: string): void {
    const row = state.rows.find((candidate) => candidate.rowId === rowId);
    if (row === undefined) {
      return;
    }
    if (row.status === 'done') {
      // measurementUid is guaranteed non-null once a row is `done` (rows.ts: MEASUREMENT_RECEIVED
      // sets both together).
      const measurementUid = row.measurementUid as string;
      const requestId = crypto.randomUUID();
      // A-10: record the requestId so the REMOVE_MEASUREMENT echo (MEASUREMENT_REMOVED with this
      // causedBy) is recognised and ignored below, instead of clearing the row a second time.
      issuedRemovalRequestIdsRef.current.add(requestId);
      dispatch({ type: 'REMOVE_ROW', rowId });
      send({ version: 1, type: 'REMOVE_MEASUREMENT', requestId, rowId, measurementUid });
      return;
    }
    if (row.status === 'drawing') {
      send({ version: 1, type: 'DEACTIVATE_TOOL', requestId: crypto.randomUUID(), rowId });
    }
    dispatch({ type: 'REMOVE_ROW', rowId });
  }

  // S-5.3 focus, host -> viewer direction: a click only means anything for a `done` row, which is
  // the only status with a real annotation in the viewer to scroll/highlight to. No state change
  // on this side (canon: "highlights / scrolls to"), no reply expected, so there is nothing to
  // dispatch into the reducer here.
  function focus(rowId: string): void {
    const row = state.rows.find((candidate) => candidate.rowId === rowId);
    if (row === undefined || row.status !== 'done' || row.measurementUid === null) {
      return;
    }
    send({
      version: 1,
      type: 'FOCUS_MEASUREMENT',
      requestId: crypto.randomUUID(),
      rowId,
      measurementUid: row.measurementUid,
    });
  }

  // Dedupe: `lastEvent` is a `useState`-style snapshot from the bridge, so a re-render that does
  // not carry a *new* event object must not reprocess the previous one. Compared by identity
  // (not by content) because that is exactly what "a new event arrived" means here.
  const readyCountRef = useRef(0);
  const processedEventRef = useRef<ViewerEvent | null>(null);
  // S-5.2 / A-10: requestIds of REMOVE_MEASUREMENT commands issued by `remove`, so the resulting
  // MEASUREMENT_REMOVED echo can be told apart from a deletion that started in the viewer.
  const issuedRemovalRequestIdsRef = useRef<Set<string>>(new Set());

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

    function processMeasurementUpdated(event: Extract<ViewerEvent, { type: 'MEASUREMENT_UPDATED' }>): void {
      const row = state.rows.find((candidate) => candidate.measurementUid === event.measurementUid);
      // Unknown uid is expected, not an error: it happens for a measurement drawn without an
      // armed row (the viewer's own MEASUREMENT_ADDED filter keeps those out of the form, so
      // there is no row to update here either). `console.debug`, not `warn`.
      if (row === undefined || row.status !== 'done') {
        console.debug('[form] update for a measurement not tracked by any row', event.measurementUid);
        return;
      }
      // Q-4: this branch only dispatches into the local reducer and never calls `send`. That is
      // the invariant that makes a host -> viewer -> host echo loop impossible on this side (A-10):
      // there is no command this handler could issue that the viewer could echo back.
      dispatch({
        type: 'MEASUREMENT_UPDATED',
        measurementUid: event.measurementUid,
        metrics: event.metrics,
      });
    }

    function processMeasurementRemoved(event: Extract<ViewerEvent, { type: 'MEASUREMENT_REMOVED' }>): void {
      // Q-4 / A-10: this is the one place a viewer-originated MEASUREMENT_* event could be
      // mistaken for our own REMOVE_MEASUREMENT bouncing back. `causedBy` set to a requestId we
      // issued means it is the echo of our own command (the row was already removed by `remove`
      // above) - ignore it and forget the id so the set does not grow forever.
      if (event.causedBy !== undefined && issuedRemovalRequestIdsRef.current.has(event.causedBy)) {
        issuedRemovalRequestIdsRef.current.delete(event.causedBy);
        console.debug('[form] ignoring our own REMOVE_MEASUREMENT echo', event.measurementUid);
        return;
      }
      const row = state.rows.find((candidate) => candidate.measurementUid === event.measurementUid);
      if (row === undefined || row.status !== 'done') {
        // Unknown uid (never tracked, e.g. drawn without an armed row) or a row that is not
        // `done` (nothing to clear): expected, not an error.
        console.debug('[form] removal for a measurement not tracked by any row', event.measurementUid);
        return;
      }
      // No `send` here by construction (A-10): a viewer-originated removal only ever dispatches
      // into the local reducer, so it can never trigger a command that the viewer would echo
      // back - there is no loop for this handler to close.
      dispatch({ type: 'MEASUREMENT_CLEARED', rowId: row.rowId });
    }

    // Single entry point shared by all event types: dedupe above by object identity, branch by
    // `type` here. VIEWER_READY and MEASUREMENT_ADDED used to be handled by separate effects;
    // folded into one so the "is this a new event" check exists exactly once.
    if (lastEvent.type === 'VIEWER_READY') {
      processViewerReady();
    } else if (lastEvent.type === 'MEASUREMENT_ADDED') {
      processMeasurementAdded(lastEvent);
    } else if (lastEvent.type === 'MEASUREMENT_UPDATED') {
      processMeasurementUpdated(lastEvent);
    } else if (lastEvent.type === 'MEASUREMENT_REMOVED') {
      processMeasurementRemoved(lastEvent);
    }
    // No cleanup needed: this effect only reacts to a new `lastEvent` reference and never
    // subscribes to anything itself (the bridge subscription lives in useBridge).
  }, [lastEvent, state.armedRowId, state.rows, send]);

  return { rows: state.rows, addRow, activate, cancel, remove, focus };
}

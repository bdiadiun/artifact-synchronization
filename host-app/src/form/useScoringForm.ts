import { useEffect, useReducer, useRef } from 'react';
import type { HostCommand, ViewerEvent } from '@scoring/contract';
import { DEFAULT_TOOL } from '../config';
import { FormActionType, RowStatus, initialFormState, reducer, type Row } from './rows';

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

export const useScoringForm = ({
  send,
  lastEvent,
}: UseScoringFormOptions): UseScoringFormResult => {
  const [state, dispatch] = useReducer(reducer, initialFormState);

  const addRow = (): void => {
    dispatch({ type: FormActionType.AddRow, rowId: crypto.randomUUID() });
  };

  const activate = (rowId: string): void => {
    const previousArmedRowId = state.armedRowId;
    dispatch({ type: FormActionType.ArmRow, rowId });
    // Only one row can be armed at a time (A-4): deactivate the previous one first.
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
      toolName: DEFAULT_TOOL,
    });
  };

  const cancel = (rowId: string): void => {
    dispatch({ type: FormActionType.DisarmRow, rowId });
    send({ version: 1, type: 'DEACTIVATE_TOOL', requestId: crypto.randomUUID(), rowId });
  };

  // Behaviour depends on row status: `done` removes the real annotation in the viewer; `drawing`
  // is cancelled first (nothing drawn yet); `pending` just drops the row.
  const remove = (rowId: string): void => {
    const row = state.rows.find((candidate) => candidate.rowId === rowId);
    if (row === undefined) {
      return;
    }
    if (row.status === RowStatus.Done) {
      if (row.measurementUid === null) {
        return;
      }
      const measurementUid = row.measurementUid;
      const requestId = crypto.randomUUID();
      // A-10: record the requestId so the REMOVE_MEASUREMENT echo is recognised and ignored below.
      issuedRemovalRequestIdsRef.current.add(requestId);
      dispatch({ type: FormActionType.RemoveRow, rowId });
      send({ version: 1, type: 'REMOVE_MEASUREMENT', requestId, rowId, measurementUid });
      return;
    }
    if (row.status === RowStatus.Drawing) {
      send({ version: 1, type: 'DEACTIVATE_TOOL', requestId: crypto.randomUUID(), rowId });
    }
    dispatch({ type: FormActionType.RemoveRow, rowId });
  };

  // Only a `done` row has a real annotation to scroll/highlight to; no reply expected.
  const focus = (rowId: string): void => {
    const row = state.rows.find((candidate) => candidate.rowId === rowId);
    if (row?.status !== RowStatus.Done || row.measurementUid === null) {
      return;
    }
    send({
      version: 1,
      type: 'FOCUS_MEASUREMENT',
      requestId: crypto.randomUUID(),
      rowId,
      measurementUid: row.measurementUid,
    });
  };

  // `lastEvent` is compared by identity: a re-render without a *new* event object must not
  // reprocess the previous one.
  const readyCountRef = useRef(0);
  const processedEventRef = useRef<ViewerEvent | null>(null);
  // requestIds of REMOVE_MEASUREMENT commands issued by `remove` (A-10 echo guard).
  const issuedRemovalRequestIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (lastEvent === null || lastEvent === processedEventRef.current) {
      return;
    }
    processedEventRef.current = lastEvent;

    // A second READY means a reload (A-9): the viewer forgot any already-flushed command, so an
    // armed row is re-sent. The first-ever READY needs no such re-send: an activation clicked
    // before it is still queued in the bridge and flushed automatically.
    const processViewerReady = (): void => {
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
    };

    const processMeasurementAdded = (
      event: Extract<ViewerEvent, { type: 'MEASUREMENT_ADDED' }>,
    ): void => {
      // A-8: a measurement drawn while nothing is armed arrives with `rowId: null` and is dropped.
      if (event.rowId === null) {
        console.info('[form] measurement without an armed row ignored', event.measurementUid);
        return;
      }
      const row = state.rows.find((candidate) => candidate.rowId === event.rowId);
      // The reducer already refuses this for a missing/non-`drawing` row; logged here so the
      // console shows *where* the no-op was decided.
      if (row?.status !== RowStatus.Drawing) {
        console.warn(
          '[form] measurement for a row that is not armed',
          event.rowId,
          event.measurementUid,
        );
        return;
      }
      dispatch({
        type: FormActionType.MeasurementReceived,
        rowId: event.rowId,
        measurementUid: event.measurementUid,
        metrics: event.metrics,
      });
    };

    const processMeasurementUpdated = (
      event: Extract<ViewerEvent, { type: 'MEASUREMENT_UPDATED' }>,
    ): void => {
      const row = state.rows.find((candidate) => candidate.measurementUid === event.measurementUid);
      // Unknown uid is expected (a measurement drawn without an armed row), not an error.
      if (row?.status !== RowStatus.Done) {
        console.debug(
          '[form] update for a measurement not tracked by any row',
          event.measurementUid,
        );
        return;
      }
      // Only dispatches locally, never `send`: no command here for the viewer to echo (A-10).
      dispatch({
        type: FormActionType.MeasurementUpdated,
        measurementUid: event.measurementUid,
        metrics: event.metrics,
      });
    };

    const processMeasurementRemoved = (
      event: Extract<ViewerEvent, { type: 'MEASUREMENT_REMOVED' }>,
    ): void => {
      // A `causedBy` matching a requestId we issued is the echo of our own REMOVE_MEASUREMENT
      // (row already cleared by `remove` above); ignore and forget it (A-10).
      if (event.causedBy !== undefined && issuedRemovalRequestIdsRef.current.has(event.causedBy)) {
        issuedRemovalRequestIdsRef.current.delete(event.causedBy);
        console.debug('[form] ignoring our own REMOVE_MEASUREMENT echo', event.measurementUid);
        return;
      }
      const row = state.rows.find((candidate) => candidate.measurementUid === event.measurementUid);
      if (row?.status !== RowStatus.Done) {
        console.debug(
          '[form] removal for a measurement not tracked by any row',
          event.measurementUid,
        );
        return;
      }
      dispatch({ type: FormActionType.MeasurementCleared, rowId: row.rowId });
    };

    if (lastEvent.type === 'VIEWER_READY') {
      processViewerReady();
    } else if (lastEvent.type === 'MEASUREMENT_ADDED') {
      processMeasurementAdded(lastEvent);
    } else if (lastEvent.type === 'MEASUREMENT_UPDATED') {
      processMeasurementUpdated(lastEvent);
    } else {
      processMeasurementRemoved(lastEvent);
    }
  }, [lastEvent, state.armedRowId, state.rows, send]);

  return { rows: state.rows, addRow, activate, cancel, remove, focus };
};

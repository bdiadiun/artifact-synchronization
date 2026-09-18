// What each viewer event does to the form. Pure wiring around `dispatch`/`send`: the row state
// itself stays in the reducer, `useViewerEvents` decides *when* these run.

import type { Dispatch } from 'react';
import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementUpdatedEvent,
} from '@scoring/contract';
import { activateToolCommand } from './commands';
import { FormActionType, RowStatus, type FormAction, type FormState } from './rows';
import { findRow, findRowByUid } from './selectors';
import type { ViewerEventHandlers } from './useViewerEvents';

export interface ViewerEventContext {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  send: (command: HostCommand) => void;
  // requestIds of the REMOVE_MEASUREMENT commands `useScoringForm` issued (A-10 echo guard); this
  // module only consumes them.
  issuedRemovalRequestIds: Set<string>;
}

// A reload means the viewer forgot any already-flushed command, so an armed row is re-sent. The
// first-ever READY needs no such re-send: an activation clicked before it is still queued in the
// bridge and flushed automatically (A-9).
const handleViewerReady = (context: ViewerEventContext, isReload: boolean): void => {
  const { armedRowId, rows } = context.state;
  if (!isReload || armedRowId === null) {
    return;
  }
  const armedRow = findRow(rows, armedRowId);
  if (armedRow === undefined) {
    return;
  }
  context.send(activateToolCommand(crypto.randomUUID(), armedRow.rowId, armedRow.toolName));
};

const handleMeasurementAdded = (
  context: ViewerEventContext,
  event: MeasurementAddedEvent,
): void => {
  // A-8: a measurement drawn while nothing is armed arrives with `rowId: null` and is dropped.
  if (event.rowId === null) {
    console.info('[form] measurement without an armed row ignored', event.measurementUid);
    return;
  }
  const row = findRow(context.state.rows, event.rowId);
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
  context.dispatch({
    type: FormActionType.MeasurementReceived,
    rowId: event.rowId,
    measurementUid: event.measurementUid,
    metrics: event.metrics,
  });
};

const handleMeasurementUpdated = (
  context: ViewerEventContext,
  event: MeasurementUpdatedEvent,
): void => {
  const row = findRowByUid(context.state.rows, event.measurementUid);
  // Unknown uid is expected (a measurement drawn without an armed row), not an error.
  if (row?.status !== RowStatus.Done) {
    console.debug('[form] update for a measurement not tracked by any row', event.measurementUid);
    return;
  }
  // Only dispatches locally, never `send`: no command here for the viewer to echo (A-10).
  context.dispatch({
    type: FormActionType.MeasurementUpdated,
    measurementUid: event.measurementUid,
    metrics: event.metrics,
  });
};

const handleMeasurementRemoved = (
  context: ViewerEventContext,
  event: MeasurementRemovedEvent,
): void => {
  // A `causedBy` matching a requestId we issued is the echo of our own REMOVE_MEASUREMENT (the row
  // is already gone); ignore and forget it (A-10).
  const { issuedRemovalRequestIds } = context;
  if (event.causedBy !== undefined && issuedRemovalRequestIds.has(event.causedBy)) {
    issuedRemovalRequestIds.delete(event.causedBy);
    console.debug('[form] ignoring our own REMOVE_MEASUREMENT echo', event.measurementUid);
    return;
  }
  const row = findRowByUid(context.state.rows, event.measurementUid);
  if (row?.status !== RowStatus.Done) {
    console.debug('[form] removal for a measurement not tracked by any row', event.measurementUid);
    return;
  }
  context.dispatch({ type: FormActionType.MeasurementCleared, rowId: row.rowId });
};

export const createViewerEventHandlers = (context: ViewerEventContext): ViewerEventHandlers => ({
  onViewerReady: (isReload: boolean): void => {
    handleViewerReady(context, isReload);
  },
  onMeasurementAdded: (event: MeasurementAddedEvent): void => {
    handleMeasurementAdded(context, event);
  },
  onMeasurementUpdated: (event: MeasurementUpdatedEvent): void => {
    handleMeasurementUpdated(context, event);
  },
  onMeasurementRemoved: (event: MeasurementRemovedEvent): void => {
    handleMeasurementRemoved(context, event);
  },
});

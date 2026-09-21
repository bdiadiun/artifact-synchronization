// Incoming half of the form: turns the bridge's `lastEvent` into one call per event, exactly once.
// It holds no row state; the caller decides what each event does.

import { useEffect, useRef } from 'react';
import type { ViewerEvent } from '@bdiadiun/scoring-contract';
import type { ViewerEventHandlers } from './useViewerEvents.props';

export type { ViewerEventHandlers } from './useViewerEvents.props';

const dispatchViewerEvent = (
  event: ViewerEvent,
  handlers: ViewerEventHandlers,
  isReload: boolean,
): void => {
  switch (event.type) {
    case 'VIEWER_READY':
      handlers.onViewerReady(isReload);
      return;
    case 'MEASUREMENT_ADDED':
      handlers.onMeasurementAdded(event);
      return;
    case 'MEASUREMENT_UPDATED':
      handlers.onMeasurementUpdated(event);
      return;
    case 'MEASUREMENT_REMOVED':
      handlers.onMeasurementRemoved(event);
      return;
    case 'MEASUREMENTS_RESTORED':
      handlers.onMeasurementsRestored(event);
      return;
    default: {
      const exhaustiveCheck: never = event;
      return exhaustiveCheck;
    }
  }
};

export const useViewerEvents = (
  lastEvent: ViewerEvent | null,
  handlers: ViewerEventHandlers,
): void => {
  const readyCountRef = useRef(0);
  // `lastEvent` is compared by identity: a re-render without a *new* event object must not
  // reprocess the previous one.
  const processedEventRef = useRef<ViewerEvent | null>(null);

  useEffect(() => {
    if (lastEvent === null || lastEvent === processedEventRef.current) {
      return;
    }
    processedEventRef.current = lastEvent;
    if (lastEvent.type === 'VIEWER_READY') {
      readyCountRef.current += 1;
    }
    dispatchViewerEvent(lastEvent, handlers, readyCountRef.current > 1);
  }, [lastEvent, handlers]);
};

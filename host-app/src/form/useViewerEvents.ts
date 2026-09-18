// Incoming half of the form: turns the bridge's `lastEvent` into one call per event, exactly once.
// It holds no row state; the caller decides what each event does.

import { useEffect, useRef } from 'react';
import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementUpdatedEvent,
  ViewerEvent,
} from '@scoring/contract';

export interface ViewerEventHandlers {
  // `isReload` is false for the first READY of the session and true for every later one (A-9).
  onViewerReady: (isReload: boolean) => void;
  onMeasurementAdded: (event: MeasurementAddedEvent) => void;
  onMeasurementUpdated: (event: MeasurementUpdatedEvent) => void;
  onMeasurementRemoved: (event: MeasurementRemovedEvent) => void;
}

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

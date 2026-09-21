import type {
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
} from '@bdiadiun/scoring-contract';

export interface ViewerEventHandlers {
  // `isReload` is false for the first READY of the session and true for every later one (A-9).
  onViewerReady: (isReload: boolean) => void;
  onMeasurementAdded: (event: MeasurementAddedEvent) => void;
  onMeasurementUpdated: (event: MeasurementUpdatedEvent) => void;
  onMeasurementRemoved: (event: MeasurementRemovedEvent) => void;
  onMeasurementsRestored: (event: MeasurementsRestoredEvent) => void;
}

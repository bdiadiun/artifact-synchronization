import type {
  HostCommand,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementUpdatedEvent,
  MeasurementsRestoredEvent,
  ViewerReadyEvent,
} from '@bdiadiun/scoring-contract';

export type ViewerEvent =
  | ViewerReadyEvent
  | MeasurementAddedEvent
  | MeasurementUpdatedEvent
  | MeasurementRemovedEvent
  | MeasurementsRestoredEvent;

export type PostToHost = (message: ViewerEvent) => boolean;

export interface CommandListenerDeps {
  hostOrigin: string;
  onCommand: (command: HostCommand) => void;
}

export interface CommandListener {
  dispose: () => void;
}

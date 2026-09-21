// The wire contract's single public entry: both sides consume it as the published package
// `@bdiadiun/scoring-contract` and never import a module of it directly (A-15, Q-7).

export { CONTRACT_VERSION, METRIC_KEY_BY_TOOL, TOOL_NAME_VALUES } from './vocabulary';
export type {
  MeasurementGeometry,
  Metric,
  MetricKey,
  Metrics,
  ToolName,
  Unit,
} from './vocabulary.props';

export { ANSWER_TYPE_BY_COMMAND } from './answers';
export type { AnsweredCommandType, AnswerTypeByCommand, AnswerTypeOf } from './answers.props';

export {
  isFiniteNumber,
  isMeasurementGeometry,
  isMetrics,
  isNonEmptyString,
  isOneOf,
  isRecord,
  isToolName,
} from './primitiveGuards';

export { HOST_COMMAND_TYPES, isHostCommand } from './hostCommands';
export type {
  ActivateToolCommand,
  DeactivateToolCommand,
  FocusMeasurementCommand,
  HostCommand,
  RemoveMeasurementCommand,
  RestoreMeasurementRequest,
  RestoreMeasurementsCommand,
} from './hostCommands.props';

export { isViewerEvent, VIEWER_EVENT_TYPES } from './viewerEvents';
export type {
  BridgeMessage,
  MeasurementAddedEvent,
  MeasurementRemovedEvent,
  MeasurementsRestoredEvent,
  MeasurementUpdatedEvent,
  RestoreFailure,
  RestoreFailureReason,
  ViewerEvent,
  ViewerReadyEvent,
} from './viewerEvents.props';

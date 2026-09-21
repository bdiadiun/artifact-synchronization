import type { MeasurementGeometry, Metric, Metrics, ToolName, Unit } from './vocabulary.props';
import { TOOL_NAME_VALUES, UNIT_VALUES } from './vocabulary';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const isUnit = (value: unknown): value is Unit =>
  typeof value === 'string' && (UNIT_VALUES as readonly string[]).includes(value);

export const isToolName = (value: unknown): value is ToolName =>
  typeof value === 'string' && (TOOL_NAME_VALUES as readonly string[]).includes(value);

export const isMetric = (value: unknown): value is Metric =>
  isRecord(value) &&
  typeof value.value === 'number' &&
  Number.isFinite(value.value) &&
  isUnit(value.unit);

export const isMetrics = (value: unknown): value is Metrics => {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every(isMetric);
};

// A world point is [x, y, z]; a shorter tuple breaks the first render in the viewer.
const WORLD_POINT_LENGTH = 3;

const isWorldPoint = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === WORLD_POINT_LENGTH &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

export const isPoints = (value: unknown): value is number[][] =>
  Array.isArray(value) && value.length > 0 && value.every(isWorldPoint);

export const isMeasurementGeometry = (value: unknown): value is MeasurementGeometry =>
  isRecord(value) &&
  isNonEmptyString(value.frameOfReferenceUid) &&
  isNonEmptyString(value.referencedImageId) &&
  isPoints(value.points) &&
  (value.label === undefined || typeof value.label === 'string');

export const hasVersion1 = (value: Record<string, unknown>): boolean => value.version === 1;

export const isOptionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

import { isMeasurementGeometry, type MeasurementGeometry } from '@bdiadiun/scoring-contract';

import { LOG_PREFIX } from './config.js';
import type { OhifMeasurementLike } from './measurements.props.js';

// A-14: the shape the host persists so the viewer can rebuild the annotation after a reload.
// Everything here comes from the measurement itself (EllipticalROI.ts:61-81); nothing is derived.

// Array.isArray narrows to `any[]`, which would spread an unchecked value into the event.
const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const copyPoint = (point: unknown): unknown => (isUnknownArray(point) ? [...point] : point);

const copyPoints = (points: unknown): unknown =>
  isUnknownArray(points) ? points.map(copyPoint) : points;

export const toGeometry = (measurement: OhifMeasurementLike): MeasurementGeometry | undefined => {
  const candidate = {
    frameOfReferenceUid: measurement.metadata?.FrameOfReferenceUID,
    referencedImageId: measurement.referencedImageId,
    // Copied so the event does not carry cornerstone's live handle arrays.
    points: copyPoints(measurement.points),
    label: typeof measurement.label === 'string' ? measurement.label : undefined,
  };

  if (!isMeasurementGeometry(candidate)) {
    console.debug(
      `${LOG_PREFIX} no restorable geometry for ${measurement.uid ?? '(no uid)'}`,
      measurement.metadata,
    );
    return undefined;
  }

  return candidate;
};

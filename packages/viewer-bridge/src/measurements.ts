import {
  isFiniteNumber,
  isMeasurementGeometry,
  type MeasurementGeometry,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import type { ScoringCommands } from './commands.js';
import {
  LOG_PREFIX,
  type OhifMeasurementEvent,
  type OhifMeasurementLike,
  type OhifMeasurementService,
  type StatsEntry,
} from './ohif.js';
import { createThrottledEmitter, type ThrottledEmitter } from './throttle.js';

// A-11: values are not rounded and travel with their unit; an unnameable unit is dropped.

// Spellings from cornerstone's getCalibratedUnits.js, plus ASCII in case the ² is dropped.
const AREA_UNITS: Record<string, Unit | undefined> = {
  'mm²': 'mm2',
  mm2: 'mm2',
  'px²': 'px2',
  px2: 'px2',
  'pixels²': 'px2',
  pixels2: 'px2',
};

const LENGTH_UNITS: Record<string, Unit | undefined> = {
  mm: 'mm',
  px: 'px',
  pixels: 'px',
};

// The stats field naming the unit and the table of spellings, per metric key.
const METRIC_SPECS = {
  area: { unitField: 'areaUnit', units: AREA_UNITS },
  // No `'mm'` default as in OHIF's Length.ts:118: mm on an uncalibrated image would break Q-6.
  length: { unitField: 'unit', units: LENGTH_UNITS },
} satisfies Record<MetricKey, { unitField: string; units: Record<string, Unit | undefined> }>;

// Ten updates a second follow a drag without visible lag and cut a 60 fps drag six-fold.
const UPDATE_INTERVAL_MS = 100;

interface MeasurementUpdate {
  toolName: string;
  metrics: Metrics;
  geometry?: MeasurementGeometry;
}

// A calibration suffix (`'mm² ERMF'`) is provenance, not a different unit.
const baseUnitToken = (raw: string): string => raw.trim().split(/\s+/)[0] ?? '';

const normaliseUnit = (raw: unknown, table: Record<string, Unit | undefined>): Unit | null => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  return table[baseUnitToken(raw)] ?? null;
};

const findStatsEntry = (measurement: OhifMeasurementLike, key: string): StatsEntry | null => {
  const data = measurement.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const preferred = data[`imageId:${String(measurement.referencedImageId)}`];

  if (preferred && isFiniteNumber(preferred[key])) {
    return preferred;
  }

  for (const entry of Object.values(data)) {
    if (entry && isFiniteNumber(entry[key])) {
      return entry;
    }
  }

  return null;
};

const readMetrics = (measurement: OhifMeasurementLike, key: MetricKey): Metrics | null => {
  const { unitField, units } = METRIC_SPECS[key];
  const stats = findStatsEntry(measurement, key);
  const unit = stats === null ? null : normaliseUnit(stats[unitField], units);

  if (stats === null || unit === null) {
    return null;
  }

  // The assertion is safe: findStatsEntry only returns an entry whose value already passed
  // isFiniteNumber.
  return { [key]: { value: stats[key] as number, unit } };
};

// Null when the measurement carries no value this contract can name; mid-drag frames without
// recomputed stats are the ordinary case, so nothing is logged here.
export const toMetrics = (measurement: OhifMeasurementLike): Metrics | null => {
  switch (measurement.toolName) {
    case 'EllipticalROI':
    case 'RectangleROI':
      return readMetrics(measurement, 'area');
    case 'Length':
      return readMetrics(measurement, 'length');
    case undefined:
    default:
      return null;
  }
};

// Array.isArray narrows to `any[]`, which would spread an unchecked value into the event.
const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const copyPoint = (point: unknown): unknown => (isUnknownArray(point) ? [...point] : point);

// A-14: what the host persists so the viewer can rebuild the annotation after a reload.
// Everything comes from the measurement itself (EllipticalROI.ts:61-81); nothing is derived.
export const toGeometry = (measurement: OhifMeasurementLike): MeasurementGeometry | undefined => {
  const candidate = {
    frameOfReferenceUid: measurement.metadata?.FrameOfReferenceUID,
    referencedImageId: measurement.referencedImageId,
    // Copied so the event does not carry cornerstone's live handle arrays.
    points: isUnknownArray(measurement.points) ? measurement.points.map(copyPoint) : undefined,
    label: typeof measurement.label === 'string' ? measurement.label : undefined,
  };

  return isMeasurementGeometry(candidate) ? candidate : undefined;
};

// Only MEASUREMENT_REMOVED carries a uid instead of the measurement (MeasurementService.ts:686-689);
// the object handlers state that here rather than trusting the event they subscribed to.
const asMeasurement = (measurement: OhifMeasurementLike | string): OhifMeasurementLike | null =>
  typeof measurement === 'string' ? null : measurement;

const readUid = (measurement: OhifMeasurementLike | null): string | null => {
  const uid = measurement?.uid;
  return typeof uid === 'string' && uid.length > 0 ? uid : null;
};

const readToolName = (measurement: OhifMeasurementLike): string =>
  typeof measurement.toolName === 'string' ? measurement.toolName : '';

const createAddedHandler =
  (channel: ViewerChannel, restoreDefaultTool: () => void) =>
  ({ measurement }: OhifMeasurementEvent): void => {
    const added = asMeasurement(measurement);
    const uid = readUid(added);

    if (added === null || uid === null) {
      console.warn(`${LOG_PREFIX} MEASUREMENT_ADDED without a uid; ignored`, measurement);
      return;
    }

    const metrics = toMetrics(added);

    if (!metrics) {
      // The row stays in "drawing" and the tool stays armed, so the user can simply draw again.
      console.warn(`${LOG_PREFIX} no metrics for measurement ${uid}; nothing sent to the host`);
      return;
    }

    const armed = channel.getArmed();

    const sent = channel.send('MEASUREMENT_ADDED', {
      // A-8: a drawing made while nothing is armed is forwarded with rowId: null.
      rowId: armed?.rowId ?? null,
      measurementUid: uid,
      toolName: readToolName(added),
      metrics,
      causedBy: armed?.requestId,
      // A-14: carried so the form can persist enough to have the annotation rebuilt after a reload.
      geometry: toGeometry(added),
    });

    // C-4.3.6: released after the measurement is posted, so a failing tool restore cannot swallow
    // the event.
    if (sent && armed) {
      restoreDefaultTool();
    }
  };

// S-5.1: every update is forwarded, throttled per measurement; the form ignores a uid it does not
// hold, which is the only place that knows whether a row is behind it.
const createUpdatedHandler =
  (updates: ThrottledEmitter<MeasurementUpdate>) =>
  ({ measurement }: OhifMeasurementEvent): void => {
    const updated = asMeasurement(measurement);
    const uid = readUid(updated);
    const metrics = updated === null ? null : toMetrics(updated);

    if (updated === null || uid === null || metrics === null) {
      return;
    }

    updates.push(uid, {
      toolName: readToolName(updated),
      metrics,
      geometry: toGeometry(updated),
    });
  };

// P-6 / A-10, the echo-loop point: a removal the host asked for answers its command, and one the
// doctor made in the viewer is an event of its own.
const createRemovedHandler =
  (
    channel: ViewerChannel,
    updates: ThrottledEmitter<MeasurementUpdate>,
    takePendingRemoval: ScoringCommands['takePendingRemoval'],
  ) =>
  ({ measurement }: OhifMeasurementEvent): void => {
    const uid = typeof measurement === 'string' ? measurement : '';

    if (uid.length === 0) {
      console.warn(`${LOG_PREFIX} MEASUREMENT_REMOVED without a uid; ignored`, measurement);
      return;
    }

    // Discarded, not flushed: a trailing UPDATED after the removal would resurrect the row.
    updates.discard(uid);

    const command = takePendingRemoval(uid);

    if (command) {
      channel.reply(command, { measurementUid: uid });
      return;
    }

    channel.send('MEASUREMENT_REMOVED', { measurementUid: uid });
  };

// P-4: measurementService, not raw cornerstone events, because it merges ANNOTATION_ADDED +
// ANNOTATION_COMPLETED into one MEASUREMENT_ADDED (MeasurementService.ts:545-576).
export const subscribeMeasurements = (
  measurementService: OhifMeasurementService | undefined,
  channel: ViewerChannel,
  commands: Pick<ScoringCommands, 'restoreDefaultTool' | 'takePendingRemoval'>,
): (() => void) => {
  if (!measurementService) {
    console.warn(`${LOG_PREFIX} measurementService unavailable; measurements will not be seen`);
    return (): void => undefined;
  }

  const emitUpdate = (uid: string, { toolName, metrics, geometry }: MeasurementUpdate): void => {
    channel.send('MEASUREMENT_UPDATED', { measurementUid: uid, toolName, metrics, geometry });
  };

  const updates = createThrottledEmitter<MeasurementUpdate>(UPDATE_INTERVAL_MS, emitUpdate);
  const handleAdded = createAddedHandler(channel, commands.restoreDefaultTool);
  const handleUpdated = createUpdatedHandler(updates);
  const handleRemoved = createRemovedHandler(channel, updates, commands.takePendingRemoval);

  const { EVENTS } = measurementService;
  const subscriptions = [
    measurementService.subscribe(EVENTS.MEASUREMENT_ADDED, handleAdded),
    measurementService.subscribe(EVENTS.MEASUREMENT_UPDATED, handleUpdated),
    measurementService.subscribe(EVENTS.MEASUREMENT_REMOVED, handleRemoved),
  ];

  return (): void => {
    subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    updates.dispose();
  };
};

import {
  MeasurementGeometry,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import type { ScoringCommands } from '../commands/handlers.js';
import {
  LOG_PREFIX,
  type OhifMeasurementEvent,
  type OhifMeasurementLike,
  type OhifMeasurementService,
  type StatsEntry,
} from '../ohif/surface.js';
import { createThrottledEmitter, type ThrottledEmitter } from '../ohif/throttle.js';

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

const METRIC_SPECS = {
  area: { unitField: 'areaUnit', units: AREA_UNITS },
  length: { unitField: 'unit', units: LENGTH_UNITS },
} satisfies Record<MetricKey, { unitField: string; units: Record<string, Unit | undefined> }>;

const UPDATE_INTERVAL_MS = 100;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

interface MeasurementUpdate {
  toolName: string;
  metrics: Metrics;
  geometry?: MeasurementGeometry;
}

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

  return { [key]: { value: stats[key] as number, unit } };
};

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

const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

const copyPoint = (point: unknown): unknown => (isUnknownArray(point) ? [...point] : point);

export const toGeometry = (measurement: OhifMeasurementLike): MeasurementGeometry | undefined => {
  const candidate = {
    frameOfReferenceUid: measurement.metadata?.FrameOfReferenceUID,
    referencedImageId: measurement.referencedImageId,
    points: isUnknownArray(measurement.points) ? measurement.points.map(copyPoint) : undefined,
    label: typeof measurement.label === 'string' ? measurement.label : undefined,
  };

  const parsed = MeasurementGeometry.safeParse(candidate);

  return parsed.success ? parsed.data : undefined;
};

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
      console.warn(`${LOG_PREFIX} no metrics for measurement ${uid}; nothing sent to the host`);
      return;
    }

    const armed = channel.getArmed();

    const sent = channel.send('MEASUREMENT_ADDED', {
      rowId: armed?.rowId ?? null,
      measurementUid: uid,
      toolName: readToolName(added),
      metrics,
      causedBy: armed?.requestId,
      geometry: toGeometry(added),
    });

    if (sent && armed) {
      restoreDefaultTool();
    }
  };

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

    updates.discard(uid);

    const command = takePendingRemoval(uid);

    if (command) {
      channel.reply(command, { measurementUid: uid });
      return;
    }

    channel.send('MEASUREMENT_REMOVED', { measurementUid: uid });
  };

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

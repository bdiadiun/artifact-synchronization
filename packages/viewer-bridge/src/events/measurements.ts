import {
  MeasurementGeometry,
  METRIC_KEY_BY_TOOL,
  ToolName,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import type { ScoringCommands } from '../commands/handlers.js';
import {
  LOG_PREFIX,
  OhifMeasurement,
  type OhifMeasurementEvent,
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

const finiteAt = (entry: StatsEntry | undefined, key: string): number | null => {
  const value = entry?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const findStatsEntry = (measurement: OhifMeasurement, key: string): StatsEntry | undefined => {
  const data = measurement.data ?? {};
  const preferred = data[`imageId:${measurement.referencedImageId ?? ''}`];
  const entries = [preferred, ...Object.values(data)];

  return entries.find((entry) => finiteAt(entry, key) !== null);
};

const readMetrics = (measurement: OhifMeasurement, key: MetricKey): Metrics | null => {
  const { unitField, units } = METRIC_SPECS[key];
  const stats = findStatsEntry(measurement, key);
  const value = finiteAt(stats, key);
  const unit = normaliseUnit(stats?.[unitField], units);

  if (value === null || unit === null) {
    return null;
  }

  return { [key]: { value, unit } };
};

export const toMetrics = (measurement: OhifMeasurement): Metrics | null => {
  const toolName = ToolName.safeParse(measurement.toolName);

  return toolName.success ? readMetrics(measurement, METRIC_KEY_BY_TOOL[toolName.data]) : null;
};

export const toGeometry = (measurement: OhifMeasurement): MeasurementGeometry | undefined =>
  MeasurementGeometry.safeParse({
    frameOfReferenceUid: measurement.metadata?.FrameOfReferenceUID,
    referencedImageId: measurement.referencedImageId,
    points: measurement.points,
    label: measurement.label,
  }).data;

const parseMeasurement = ({ measurement }: OhifMeasurementEvent): OhifMeasurement | undefined =>
  OhifMeasurement.safeParse(measurement).data;

const announceAdded = (
  channel: ViewerChannel,
  restoreDefaultTool: () => void,
  measurement: OhifMeasurement,
): void => {
  const metrics = toMetrics(measurement);

  if (!metrics) {
    console.warn(
      `${LOG_PREFIX} no metrics for measurement ${measurement.uid}; nothing sent to the host`,
    );
    return;
  }

  const armed = channel.getArmed();

  const sent = channel.send('MEASUREMENT_ADDED', {
    rowId: armed?.rowId ?? null,
    measurementUid: measurement.uid,
    toolName: measurement.toolName,
    metrics,
    causedBy: armed?.requestId,
    geometry: toGeometry(measurement),
  });

  if (sent && armed) {
    restoreDefaultTool();
  }
};

const queueUpdate = (
  updates: ThrottledEmitter<MeasurementUpdate>,
  measurement: OhifMeasurement,
): void => {
  const metrics = toMetrics(measurement);

  if (metrics === null) {
    return;
  }

  updates.push(measurement.uid, {
    toolName: measurement.toolName,
    metrics,
    geometry: toGeometry(measurement),
  });
};

const announceRemoved = (
  channel: ViewerChannel,
  takePendingRemoval: ScoringCommands['takePendingRemoval'],
  measurementUid: string,
): void => {
  const command = takePendingRemoval(measurementUid);

  if (command) {
    channel.reply(command, { measurementUid });
    return;
  }

  channel.send('MEASUREMENT_REMOVED', { measurementUid });
};

export const subscribeMeasurements = (
  measurementService: OhifMeasurementService,
  channel: ViewerChannel,
  commands: Pick<ScoringCommands, 'restoreDefaultTool' | 'takePendingRemoval'>,
): (() => void) => {
  const emitUpdate = (uid: string, { toolName, metrics, geometry }: MeasurementUpdate): void => {
    channel.send('MEASUREMENT_UPDATED', { measurementUid: uid, toolName, metrics, geometry });
  };

  const updates = createThrottledEmitter<MeasurementUpdate>(UPDATE_INTERVAL_MS, emitUpdate);

  const handleAdded = (event: OhifMeasurementEvent): void => {
    const measurement = parseMeasurement(event);

    if (measurement === undefined) {
      console.warn(
        `${LOG_PREFIX} MEASUREMENT_ADDED is not a measurement; ignored`,
        event.measurement,
      );
      return;
    }

    announceAdded(channel, commands.restoreDefaultTool, measurement);
  };

  const handleUpdated = (event: OhifMeasurementEvent): void => {
    const measurement = parseMeasurement(event);

    if (measurement !== undefined) {
      queueUpdate(updates, measurement);
    }
  };

  const handleRemoved = ({ measurement }: OhifMeasurementEvent): void => {
    if (typeof measurement !== 'string' || measurement.length === 0) {
      console.warn(`${LOG_PREFIX} MEASUREMENT_REMOVED without a uid; ignored`, measurement);
      return;
    }

    updates.discard(measurement);
    announceRemoved(channel, commands.takePendingRemoval, measurement);
  };

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

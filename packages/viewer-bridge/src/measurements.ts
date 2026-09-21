import {
  isFiniteNumber,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';

import { LOG_PREFIX } from './config.js';
import type { MetricsOptions, OhifMeasurementLike, StatsEntry } from './measurements.props.js';

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

// A calibration suffix (`'mm² ERMF'`) is provenance, not a different unit.
const baseUnitToken = (raw: string): string => raw.trim().split(/\s+/)[0] ?? '';

const note = (quiet: boolean | undefined, message: string, detail?: unknown): void => {
  const log = quiet ? console.debug : console.warn;

  if (detail === undefined) {
    log(message);
  } else {
    log(message, detail);
  }
};

const normaliseUnit = (
  raw: unknown,
  table: Record<string, Unit | undefined>,
  context: string,
  quiet?: boolean,
): Unit | null => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    note(quiet, `${LOG_PREFIX} ${context}: missing unit`, raw);
    return null;
  }

  const unit = table[baseUnitToken(raw)];

  if (!unit) {
    note(quiet, `${LOG_PREFIX} ${context}: unsupported unit string "${raw}"`);
    return null;
  }

  return unit;
};

const findStatsEntry = (measurement: OhifMeasurementLike, key: string): StatsEntry | null => {
  const data = measurement.data;

  if (!data || typeof data !== 'object') {
    return null;
  }

  const preferredKey = `imageId:${String(measurement.referencedImageId)}`;
  const preferred = data[preferredKey];

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

// The stats field naming the unit and the table of spellings, per metric key.
const METRIC_SPECS = {
  area: { unitField: 'areaUnit', units: AREA_UNITS },
  // No `'mm'` default as in OHIF's Length.ts:118: mm on an uncalibrated image would break Q-6.
  length: { unitField: 'unit', units: LENGTH_UNITS },
} satisfies Record<MetricKey, { unitField: string; units: Record<string, Unit | undefined> }>;

const readMetrics = (
  measurement: OhifMeasurementLike,
  key: MetricKey,
  quiet?: boolean,
): Metrics | null => {
  const { unitField, units } = METRIC_SPECS[key];
  const stats = findStatsEntry(measurement, key);

  if (!stats) {
    note(
      quiet,
      `${LOG_PREFIX} no ${key} in measurement.data for ${measurement.uid ?? '(no uid)'}`,
      measurement.data,
    );
    return null;
  }

  const unit = normaliseUnit(
    stats[unitField],
    units,
    `${key} of ${measurement.uid ?? '(no uid)'}`,
    quiet,
  );

  if (!unit) {
    return null;
  }

  // The assertion is safe: findStatsEntry only returns an entry whose value already passed
  // isFiniteNumber.
  return { [key]: { value: stats[key] as number, unit } };
};

export const toMetrics = (
  measurement: OhifMeasurementLike,
  { quiet }: MetricsOptions = {},
): Metrics | null => {
  switch (measurement.toolName) {
    case 'EllipticalROI':
    case 'RectangleROI':
      return readMetrics(measurement, 'area', quiet);
    case 'Length':
      return readMetrics(measurement, 'length', quiet);
    case undefined:
    default:
      note(quiet, `${LOG_PREFIX} no metric mapping for tool "${measurement.toolName ?? '(none)'}"`);
      return null;
  }
};

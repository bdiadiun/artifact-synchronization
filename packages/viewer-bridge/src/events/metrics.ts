// What OHIF's measurement object means for the host: the metric the row's tool produces, read
// from cachedStats with its unit normalised to the contract's vocabulary, and the geometry the
// form persists to rebuild the annotation later (A-14).

import {
  MeasurementGeometry,
  METRIC_KEY_BY_TOOL,
  ToolName,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';
import { OhifMeasurement, type OhifMeasurementEvent, type StatsEntry } from '../ohif/surface.js';

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

interface Measured {
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  geometry: MeasurementGeometry | undefined;
}

// Null when the event carries no measurement object or a measurement whose tool the form has no
// metric for.
export const measure = ({ measurement }: OhifMeasurementEvent): Measured | null => {
  const parsed = OhifMeasurement.safeParse(measurement).data;
  const metrics = parsed === undefined ? null : toMetrics(parsed);

  if (parsed === undefined || metrics === null) {
    return null;
  }

  return {
    measurementUid: parsed.uid,
    toolName: parsed.toolName,
    metrics,
    geometry: toGeometry(parsed),
  };
};

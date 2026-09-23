import {
  MeasurementGeometry,
  METRIC_KEYS_BY_TOOL,
  ToolName,
  type Metric,
  type MetricKey,
  type Metrics,
  type Unit,
} from '@bdiadiun/scoring-contract';
import { z } from 'zod';

export const StatsEntry = z.record(z.string(), z.unknown());
export type StatsEntry = z.infer<typeof StatsEntry>;

export const OhifMeasurement = z.object({
  uid: z.string().min(1),
  toolName: z.string(),
  referencedImageId: z.string().optional(),
  label: z.string().optional(),
  metadata: z.object({ FrameOfReferenceUID: z.string().optional() }).nullish(),
  points: z.array(z.array(z.number())).optional(),
  data: z.record(z.string(), StatsEntry.optional()).nullish(),
});
export type OhifMeasurement = z.infer<typeof OhifMeasurement>;

interface Measured {
  measurementUid: string;
  toolName: string;
  metrics: Metrics;
  geometry: MeasurementGeometry | undefined;
}

const UNITS: Record<string, Unit | undefined> = {
  'mm²': 'mm2',
  mm2: 'mm2',
  'px²': 'px2',
  px2: 'px2',
  'pixels²': 'px2',
  pixels2: 'px2',
  mm: 'mm',
  px: 'px',
  pixels: 'px',
};

const UNIT_FIELD: Record<MetricKey, string> = {
  area: 'areaUnit',
  length: 'unit',
};

const firstToken = (raw: string): string => raw.trim().split(/\s+/)[0] ?? '';

const statsOf = (measurement: OhifMeasurement): StatsEntry | undefined => {
  const data = measurement.data ?? {};

  return data[`imageId:${measurement.referencedImageId ?? ''}`] ?? Object.values(data)[0];
};

const readMetric = (stats: StatsEntry, key: MetricKey): Metric | null => {
  const value = stats[key];
  const raw = stats[UNIT_FIELD[key]];
  const unit = typeof raw === 'string' ? UNITS[firstToken(raw)] : undefined;

  return typeof value === 'number' && Number.isFinite(value) && unit !== undefined ? { value, unit } : null;
};

export const toMetrics = (measurement: OhifMeasurement): Metrics | null => {
  const toolName = ToolName.safeParse(measurement.toolName);
  const stats = statsOf(measurement);
  if (!toolName.success || stats === undefined) {
    return null;
  }
  const metrics: Metrics = {};
  for (const key of METRIC_KEYS_BY_TOOL[toolName.data]) {
    const metric = readMetric(stats, key);
    if (metric !== null) {
      metrics[key] = metric;
    }
  }

  return Object.keys(metrics).length > 0 ? metrics : null;
};

export const toGeometry = (measurement: OhifMeasurement): MeasurementGeometry | undefined =>
  MeasurementGeometry.safeParse({
    frameOfReferenceUid: measurement.metadata?.FrameOfReferenceUID,
    referencedImageId: measurement.referencedImageId,
    points: measurement.points,
    label: measurement.label,
  }).data;

export const measure = ({ measurement }: { measurement: unknown }): Measured | null => {
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

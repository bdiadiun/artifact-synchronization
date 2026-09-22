import type { TOOL_NAME_VALUES, UNIT_VALUES } from './vocabulary';

export type Unit = (typeof UNIT_VALUES)[number];

export interface Metric {
  value: number;
  unit: Unit;
}

export type Metrics = Record<string, Metric>;

export type ToolName = (typeof TOOL_NAME_VALUES)[number];

export type MetricKey = 'area' | 'length';
export interface MeasurementGeometry {
  frameOfReferenceUid: string;
  referencedImageId: string;
  points: number[][];
  label?: string;
}
export interface ArmedRow {
  rowId: string;
  requestId: string;
}

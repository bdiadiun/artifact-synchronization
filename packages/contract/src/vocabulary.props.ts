// Type-only imports of the tuples: the unions below are their members, so neither list is written
// twice and nothing is imported at runtime in either direction.
import type { TOOL_NAME_VALUES, UNIT_VALUES } from './vocabulary';

// Normalised spelling used on the wire; the display layer renders mm² / px² for humans.
export type Unit = (typeof UNIT_VALUES)[number];

export interface Metric {
  value: number;
  unit: Unit;
}

// A new measurement (e.g. perimeter, P-8) is a new key, not a new message shape.
export type Metrics = Record<string, Metric>;

export type ToolName = (typeof TOOL_NAME_VALUES)[number];

// The metric key a tool writes into `Metrics`; both sides derive it from the tool name rather
// than storing it, so the two can never drift apart.
export type MetricKey = 'area' | 'length';

// What the viewer needs to rebuild an annotation after a reload (A-14, S-5.6).
export interface MeasurementGeometry {
  frameOfReferenceUid: string;
  referencedImageId: string;
  points: number[][];
  label?: string;
}

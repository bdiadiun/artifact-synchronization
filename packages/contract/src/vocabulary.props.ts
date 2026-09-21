// Normalised spelling used on the wire; the display layer renders mm² / px² for humans.
export type Unit = 'mm2' | 'px2' | 'mm' | 'px';

export interface Metric {
  value: number;
  unit: Unit;
}

// A new measurement (e.g. perimeter, P-8) is a new key, not a new message shape.
export type Metrics = Record<string, Metric>;

export type ToolName = 'EllipticalROI' | 'RectangleROI' | 'Length';

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

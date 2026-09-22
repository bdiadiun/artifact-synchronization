import { z } from 'zod';

const WORLD_POINT_LENGTH = 3;

export const ToolName = z.enum(['EllipticalROI', 'RectangleROI', 'Length']);
export type ToolName = z.infer<typeof ToolName>;

export const Unit = z.enum(['mm2', 'px2', 'mm', 'px']);
export type Unit = z.infer<typeof Unit>;

export const Metric = z.object({
  value: z.number(),
  unit: Unit,
});
export type Metric = z.infer<typeof Metric>;

export const MetricKey = z.enum(['area', 'length']);
export type MetricKey = z.infer<typeof MetricKey>;

export const Metrics = z.partialRecord(MetricKey, Metric);
export type Metrics = z.infer<typeof Metrics>;

export const MeasurementGeometry = z.object({
  frameOfReferenceUid: z.string().min(1),
  referencedImageId: z.string().min(1),
  points: z.array(z.array(z.number()).length(WORLD_POINT_LENGTH)).min(1),
  label: z.string().optional(),
});
export type MeasurementGeometry = z.infer<typeof MeasurementGeometry>;

export const METRIC_KEY_BY_TOOL = {
  EllipticalROI: 'area',
  RectangleROI: 'area',
  Length: 'length',
} as const satisfies Record<ToolName, MetricKey>;

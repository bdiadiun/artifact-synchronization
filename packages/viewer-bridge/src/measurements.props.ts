// cachedStats keyed per render target, normally `imageId:<referencedImageId>`
// (measurementServiceMappings/EllipticalROI.ts:110); no top-level area.
export type StatsEntry = Record<string, unknown>;

export interface OhifMeasurementLike {
  uid?: string;
  toolName?: string;
  referencedImageId?: string;
  data?: Record<string, StatsEntry | undefined> | null;
  // A-14 restore inputs; `metadata` is the cornerstone annotation metadata by reference.
  points?: unknown;
  label?: string;
  metadata?: { FrameOfReferenceUID?: string } | null;
}

export interface MetricsOptions {
  quiet?: boolean;
}

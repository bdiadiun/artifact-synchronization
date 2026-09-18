import type { ToolName } from '@scoring/contract';

// The only origin accepted for incoming viewer messages (A-2).
export const VIEWER_ORIGIN = 'http://localhost:3000';

// Single edit point for the ellipse -> RectangleROI live change (P-7).
export const DEFAULT_TOOL: ToolName = 'EllipticalROI';

// Tool armed for length rows (S-5.4); kept beside DEFAULT_TOOL as the other row kind's edit point.
export const LENGTH_TOOL: ToolName = 'Length';

export const HOST_ORIGIN = 'http://localhost:5173';

export const STUDY_INSTANCE_UID = '1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1';

export const viewerUrl = (): string =>
  `${VIEWER_ORIGIN}/viewer?StudyInstanceUIDs=${STUDY_INSTANCE_UID}`;

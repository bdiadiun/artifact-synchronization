import { isViewerEvent, type ToolName, type ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Channel, ChannelOptions } from '@bdiadiun/scoring-channel';

// The only origin accepted for incoming viewer messages (A-2).
export const VIEWER_ORIGIN = 'http://localhost:3000';

// The viewer is the page's one peer: every `useChannel` call names it with this, and the channel
// holds commands back until the viewer's own VIEWER_READY names its window.
export const VIEWER_CHANNEL: ChannelOptions<ViewerEvent> = {
  peerOrigin: VIEWER_ORIGIN,
  accept: isViewerEvent,
  readyOn: 'VIEWER_READY',
};

export type HostChannel = Channel<ViewerEvent>;

// Single edit point for the ellipse -> RectangleROI live change (P-7).
export const DEFAULT_TOOL: ToolName = 'EllipticalROI';

export const LENGTH_TOOL: ToolName = 'Length';

// Used whenever the form's own URL names no study, or names one that is not a valid UID.
export const FALLBACK_STUDY_INSTANCE_UID = '1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1';

// The query parameter of the form's own page that selects the study to open.
const STUDY_PARAM = 'study';

// DICOM UID grammar: dot-separated numeric components, at most 64 characters (PS3.5 §9.1).
const UID_PATTERN = /^\d+(?:\.\d+)*$/;
const UID_MAX_LENGTH = 64;

const isStudyInstanceUid = (value: string): boolean =>
  value.length <= UID_MAX_LENGTH && UID_PATTERN.test(value);

// The study ends up inside the viewer iframe `src`, so anything but a UID is rejected rather than
// escaped: a free-form value could append its own query parameters or repoint the path.
const readStudyFromLocation = (): string => {
  const requested = new URLSearchParams(window.location.search).get(STUDY_PARAM);
  if (requested === null) {
    return FALLBACK_STUDY_INSTANCE_UID;
  }
  if (!isStudyInstanceUid(requested)) {
    console.warn(`[config] ignoring invalid "${STUDY_PARAM}" query parameter`, requested);
    return FALLBACK_STUDY_INSTANCE_UID;
  }
  return requested;
};

// Read once per page load: the page has no routing, so the study cannot change while it is open,
// and a rejected `study` parameter is reported once rather than on every render.
let resolvedStudyInstanceUid: string | null = null;

export const getStudyInstance = (): string => {
  resolvedStudyInstanceUid ??= readStudyFromLocation();
  return resolvedStudyInstanceUid;
};

export const viewerUrl = (): string =>
  `${VIEWER_ORIGIN}/viewer?StudyInstanceUIDs=${encodeURIComponent(getStudyInstance())}`;

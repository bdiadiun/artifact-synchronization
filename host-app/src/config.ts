import { isViewerEvent, type ToolName, type ViewerEvent } from '@bdiadiun/scoring-contract';
import type { Channel, ChannelOptions } from '@bdiadiun/scoring-channel';

export const VIEWER_ORIGIN = 'http://localhost:3000';

export const VIEWER_CHANNEL: ChannelOptions<ViewerEvent> = {
  peerOrigin: VIEWER_ORIGIN,
  accept: isViewerEvent,
  readyOn: 'VIEWER_READY',
};

export type HostChannel = Channel<ViewerEvent>;

export const DEFAULT_TOOL: ToolName = 'EllipticalROI';

export const LENGTH_TOOL: ToolName = 'Length';

export const FALLBACK_STUDY_INSTANCE_UID = '1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1';

const STUDY_PARAM = 'study';

const UID_PATTERN = /^\d+(?:\.\d+)*$/;
const UID_MAX_LENGTH = 64;

const isStudyInstanceUid = (value: string): boolean => value.length <= UID_MAX_LENGTH && UID_PATTERN.test(value);

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

let resolvedStudyInstanceUid: string | null = null;

export const getStudyInstance = (): string => {
  resolvedStudyInstanceUid ??= readStudyFromLocation();
  return resolvedStudyInstanceUid;
};

export const viewerUrl = (): string =>
  `${VIEWER_ORIGIN}/viewer?StudyInstanceUIDs=${encodeURIComponent(getStudyInstance())}`;

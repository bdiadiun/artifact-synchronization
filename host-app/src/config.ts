// Origin of the viewer app; the only origin accepted for incoming viewer messages (decision A-2).
export const VIEWER_ORIGIN = 'http://localhost:3000';

// Origin of this host app; used as the targetOrigin when posting messages into the viewer iframe.
export const HOST_ORIGIN = 'http://localhost:5173';

// A study served by the OHIF default public DICOMweb data source (C-4.1.2, C-4.1.3).
export const STUDY_INSTANCE_UID = '1.3.6.1.4.1.25403.345050719074.3824.20170125113417.1';

// Builds the direct viewer link for a specific study, used as the iframe src (C-4.1.3).
export function viewerUrl(): string {
  return `${VIEWER_ORIGIN}/viewer?StudyInstanceUIDs=${STUDY_INSTANCE_UID}`;
}

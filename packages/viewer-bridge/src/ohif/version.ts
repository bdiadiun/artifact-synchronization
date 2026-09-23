import type { CustomizationModuleEntry, OverlayItemCustomization } from './surface.js';

// OHIF's webpack replaces this exact expression at build time (webpack.base.js:32,46).
declare const process: { env: { VERSION_NUMBER?: string } };

export const VIEWER_VERSION = process.env.VERSION_NUMBER ?? 'unknown';

// S-5.5: the version in the corner of every viewport, appended to OHIF's own overlay items.
const versionOverlayItem: OverlayItemCustomization = {
  id: 'scoringBridgeVersion',
  inheritsFrom: 'ohif.overlayItem',
  title: 'OHIF viewer version',
  contentF: () => `OHIF ${VIEWER_VERSION}`,
};

export const getCustomizationModule = (): CustomizationModuleEntry[] => [
  {
    name: 'default',
    value: { 'viewportOverlay.bottomRight': { $push: [versionOverlayItem] } },
  },
];

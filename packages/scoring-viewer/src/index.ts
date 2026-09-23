import { getContextModule } from './ScoringViewer.js';
import type { OhifExtension } from './ohif/surface.js';
import { getCustomizationModule } from './ohif/version.js';

export const SCORING_VIEWER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-viewer';

export const scoringViewerExtension: OhifExtension = {
  id: SCORING_VIEWER_EXTENSION_ID,
  getContextModule,
  getCustomizationModule,
};

export type { OhifExtension, OhifExtensionManager, OhifExtensionParams } from './ohif/surface.js';

export default scoringViewerExtension;

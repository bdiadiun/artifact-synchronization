import { getContextModule } from './ScoringBridge.js';
import type { OhifExtension } from './ohif/surface.js';
import { getCustomizationModule } from './ohif/version.js';

export const SCORING_BRIDGE_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-bridge';

export const scoringBridgeExtension: OhifExtension = {
  id: SCORING_BRIDGE_EXTENSION_ID,
  getContextModule,
  getCustomizationModule,
};

export type { OhifExtension, OhifExtensionManager, OhifExtensionParams } from './ohif/surface.js';

export default scoringBridgeExtension;

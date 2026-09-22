import { createScoringBridgeExtension } from './extension.js';

export { createScoringBridgeExtension, SCORING_BRIDGE_EXTENSION_ID } from './extension.js';
export type {
  OhifAsyncExtension,
  OhifExtension,
  OhifExtensionManager,
  OhifExtensionParams,
  ScoringBridgeAppConfig,
} from './ohif/surface.js';

export default createScoringBridgeExtension();

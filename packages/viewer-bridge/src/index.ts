// The package's single public entry. OHIF's generated loader imports the default export of the
// package name listed in pluginConfig.json (writePluginImportsFile.js:89-94), so the configured
// extension is the default export and the factory is there for a host that registers it itself.

import { createScoringBridgeExtension } from './extension.js';

export { createScoringBridgeExtension, SCORING_BRIDGE_EXTENSION_ID } from './extension.js';
export type {
  OhifAsyncExtension,
  OhifExtension,
  OhifExtensionManager,
  OhifExtensionParams,
  ScoringBridgeAppConfig,
} from './ohif.js';

export default createScoringBridgeExtension();

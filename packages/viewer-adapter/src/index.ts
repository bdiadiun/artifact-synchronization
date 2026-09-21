// The package's single public entry. OHIF's generated loader imports the default export of the
// package name listed in pluginConfig.json (writePluginImportsFile.js:89-94), so the configured
// extension is the default export and the factory is there for a host that registers it itself.

import { createScoringAdapterExtension } from './extension.js';

export { createScoringAdapterExtension, SCORING_ADAPTER_EXTENSION_ID } from './extension.js';
export { createChildren } from './children.js';
export type { ScoringAdapterExtensionOptions } from './extension.js';
export type { AdapterChildren } from './children.js';

export default createScoringAdapterExtension();

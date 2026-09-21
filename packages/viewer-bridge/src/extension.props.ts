import type { OhifExtensionParams } from './ohif.props.js';
import type { CustomizationModuleEntry } from './getCustomizationModule.props.js';

// The three members ExtensionManager reads from this extension: the id it registers modules under
// (ExtensionManager.ts:260-273), the pre-registration hook and one module getter.
export interface OhifExtension {
  id: string;
  preRegistration: (params: OhifExtensionParams) => void;
  getCustomizationModule: () => CustomizationModuleEntry[];
}

export interface ScoringBridgeExtensionOptions {
  // Overrides window.config.scoringBridge.hostOrigin, for a host that registers the extension
  // itself instead of through pluginConfig.json.
  hostOrigin?: string;
}

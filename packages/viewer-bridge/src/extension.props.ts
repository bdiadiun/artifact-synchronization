import type { OhifExtensionParams } from './ohif.props.js';
import type { CustomizationModuleEntry } from './getCustomizationModule.props.js';

// The three members ExtensionManager reads from this extension: the id it registers modules under
// (ExtensionManager.ts:260-273), the pre-registration hook and one module getter.
export interface OhifExtension {
  id: string;
  preRegistration: (params: OhifExtensionParams) => void;
  // Read only when the extension declares one (ExtensionManager.ts:297-341), which an extension
  // that contributes no module does not.
  getCustomizationModule?: () => CustomizationModuleEntry[];
}

// The manager awaits the hook (ExtensionManager.ts:277), so an extension whose pre-registration is
// asynchronous is registered before the application finishes starting. Declared here beside the
// synchronous shape so the extension contract stays in one file.
export interface OhifAsyncExtension extends Omit<OhifExtension, 'preRegistration'> {
  preRegistration: (params: OhifExtensionParams) => Promise<void>;
}

export interface ScoringBridgeExtensionOptions {
  // Overrides window.config.scoringBridge.hostOrigin, for a host that registers the extension
  // itself instead of through pluginConfig.json.
  hostOrigin?: string;
}

import type {
  OhifAsyncExtension,
  OhifExtensionParams,
} from '@bdiadiun/ohif-extension-scoring-bridge';
import { createChildren } from './children.js';
import { LOG_PREFIX } from './config.js';
import { registerChildren } from './registerChildren.js';
import type { ScoringAdapterExtensionOptions } from './extension.props.js';

// Every OHIF extension registers under its package name; the id is written out rather than read
// from package.json, which a published bundle does not ship next to its modules.
export const SCORING_ADAPTER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-adapter';

export const createScoringAdapterExtension = (
  options: ScoringAdapterExtensionOptions = {},
): OhifAsyncExtension => ({
  id: SCORING_ADAPTER_EXTENSION_ID,

  preRegistration: async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
    // OHIF always passes the manager (ExtensionManager.ts:276-286); the described surface keeps it
    // optional like every other member, so its absence is reported instead of assumed away.
    if (extensionManager === undefined) {
      console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
      return;
    }

    await registerChildren(extensionManager, createChildren(options).extensions);
  },
});

import type {
  OhifAsyncExtension,
  OhifExtensionParams,
} from '@bdiadiun/ohif-extension-scoring-bridge';
import { createChildren } from './children.js';
import { LOG_PREFIX } from './config.js';
import { registerChildren } from './registerChildren.js';

export interface ScoringAdapterExtensionOptions {
  hostOrigin?: string;
}

export const SCORING_ADAPTER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-adapter';

export const createScoringAdapterExtension = (
  options: ScoringAdapterExtensionOptions = {},
): OhifAsyncExtension => {
  const preRegistration = async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
    if (extensionManager === undefined) {
      console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
      return;
    }

    await registerChildren(extensionManager, createChildren(options).extensions);
  };

  return { id: SCORING_ADAPTER_EXTENSION_ID, preRegistration };
};

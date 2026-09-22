import { createScoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type {
  OhifAsyncExtension,
  OhifExtension,
  OhifExtensionParams,
} from '@bdiadiun/ohif-extension-scoring-bridge';
import { LOG_PREFIX } from './config.js';
import { registerChildren } from './registerChildren.js';

export const SCORING_ADAPTER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-adapter';

export const createScoringAdapterExtension = (): OhifAsyncExtension => {
  const children: readonly OhifExtension[] = [createScoringBridgeExtension()];

  const preRegistration = async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
    if (extensionManager === undefined) {
      console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
      return;
    }

    await registerChildren(extensionManager, children);
  };

  return { id: SCORING_ADAPTER_EXTENSION_ID, preRegistration };
};

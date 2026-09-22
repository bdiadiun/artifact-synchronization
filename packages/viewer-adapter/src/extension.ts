import { createScoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type {
  OhifAsyncExtension,
  OhifExtensionParams,
} from '@bdiadiun/ohif-extension-scoring-bridge';

const LOG_PREFIX = '[scoring-adapter]';

export const SCORING_ADAPTER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-adapter';

export const createScoringAdapterExtension = (): OhifAsyncExtension => {
  const bridge = createScoringBridgeExtension();

  const preRegistration = async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
    if (extensionManager === undefined) {
      console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
      return;
    }

    try {
      await extensionManager.registerExtension(bridge);
    } catch (error) {
      console.error(`${LOG_PREFIX} ${bridge.id} was not registered`, error);
    }
  };

  return { id: SCORING_ADAPTER_EXTENSION_ID, preRegistration };
};

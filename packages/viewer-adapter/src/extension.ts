import { scoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { OhifExtension, OhifExtensionParams } from '@bdiadiun/ohif-extension-scoring-bridge';

const LOG_PREFIX = '[scoring-adapter]';

export const SCORING_ADAPTER_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-adapter';

// A-20: the fork lists this one package; it registers the bridge extension itself.
const preRegistration = async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
  if (extensionManager === undefined) {
    console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
    return;
  }

  try {
    await extensionManager.registerExtension(scoringBridgeExtension);
  } catch (error) {
    console.error(`${LOG_PREFIX} ${scoringBridgeExtension.id} was not registered`, error);
  }
};

export const scoringAdapterExtension: OhifExtension = {
  id: SCORING_ADAPTER_EXTENSION_ID,
  preRegistration,
};

import { scoringViewerExtension } from '@bdiadiun/ohif-extension-scoring-viewer';
import type { OhifExtension, OhifExtensionParams } from '@bdiadiun/ohif-extension-scoring-viewer';

const LOG_PREFIX = '[extension-loader]';

export const EXTENSION_LOADER_ID = '@bdiadiun/ohif-extension-loader';

const preRegistration = async ({ extensionManager }: OhifExtensionParams): Promise<void> => {
  if (extensionManager === undefined) {
    console.error(`${LOG_PREFIX} no extension manager was passed; no extension was registered`);
    return;
  }

  try {
    await extensionManager.registerExtension(scoringViewerExtension);
  } catch (error) {
    console.error(`${LOG_PREFIX} ${scoringViewerExtension.id} was not registered`, error);
  }
};

export const extensionLoader: OhifExtension = {
  id: EXTENSION_LOADER_ID,
  preRegistration,
};

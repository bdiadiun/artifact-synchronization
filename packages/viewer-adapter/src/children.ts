import { createScoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { OhifExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { ScoringAdapterExtensionOptions } from './extension.js';

export interface AdapterChildren {
  extensions: readonly OhifExtension[];
}

export const createChildren = (options: ScoringAdapterExtensionOptions): AdapterChildren => ({
  extensions: [createScoringBridgeExtension({ hostOrigin: options.hostOrigin })],
});

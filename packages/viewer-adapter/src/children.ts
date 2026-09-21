import { createScoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { OhifExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { ScoringAdapterExtensionOptions } from './extension.js';

export interface AdapterChildren {
  extensions: readonly OhifExtension[];
}

// The one place that says what this adapter hosts. Registration order is the array order, so a
// child that another one depends on goes first.
export const createChildren = (options: ScoringAdapterExtensionOptions): AdapterChildren => ({
  extensions: [createScoringBridgeExtension({ hostOrigin: options.hostOrigin })],
});

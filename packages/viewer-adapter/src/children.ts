import { createScoringBridgeExtension } from '@bdiadiun/ohif-extension-scoring-bridge';
import type { AdapterChildren } from './children.props.js';
import type { ScoringAdapterExtensionOptions } from './extension.props.js';

// The one place that says what this adapter hosts. Registration order is the array order, so a
// child that another one depends on goes first.
export const createChildren = (options: ScoringAdapterExtensionOptions): AdapterChildren => ({
  extensions: [createScoringBridgeExtension({ hostOrigin: options.hostOrigin })],
});

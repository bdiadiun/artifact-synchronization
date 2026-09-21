export interface ScoringAdapterExtensionOptions {
  // Forwarded to the bridge child; without it the bridge reads
  // window.config.scoringBridge.hostOrigin itself.
  hostOrigin?: string;
}

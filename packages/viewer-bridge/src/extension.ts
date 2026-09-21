import { createBridge } from './bridge.js';
import { LOG_PREFIX } from './config.js';
import { getCustomizationModule } from './getCustomizationModule.js';
import type { OhifExtensionParams, ScoringBridgeAppConfig } from './ohif.props.js';
import type { OhifExtension, ScoringBridgeExtensionOptions } from './extension.props.js';

// Every OHIF extension registers under its package name; the id is written out rather than read
// from package.json, which a published bundle does not ship next to its modules.
export const SCORING_BRIDGE_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-bridge';

const readHostOrigin = (
  options: ScoringBridgeExtensionOptions,
  appConfig: ScoringBridgeAppConfig | undefined,
): string | undefined => options.hostOrigin ?? appConfig?.scoringBridge?.hostOrigin;

export const createScoringBridgeExtension = (
  options: ScoringBridgeExtensionOptions = {},
): OhifExtension => ({
  id: SCORING_BRIDGE_EXTENSION_ID,

  preRegistration: ({ servicesManager, commandsManager, appConfig }: OhifExtensionParams): void => {
    const hostOrigin = readHostOrigin(options, appConfig);

    // Q-2: the origin is what every incoming message is checked against and the only targetOrigin
    // messages go out with, and '*' is never an option, so an unconfigured viewer runs unbridged.
    if (hostOrigin === undefined || hostOrigin.length === 0) {
      console.error(
        `${LOG_PREFIX} no host origin configured; set window.config.scoringBridge.hostOrigin to the embedding form's origin`,
      );
      return;
    }

    const bridge = createBridge({ servicesManager, commandsManager, hostOrigin });

    // Q-5: onModeExit is a mode transition the bridge must outlive, and extensions have no
    // unregister hook, so the bridge is disposed with the page.
    const onPageHide = (): void => {
      bridge.dispose();
      window.removeEventListener('pagehide', onPageHide);
    };

    window.addEventListener('pagehide', onPageHide);
  },

  getCustomizationModule,
});

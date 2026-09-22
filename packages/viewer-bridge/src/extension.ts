import { createDisposerSet, createViewerChannel } from '@bdiadiun/scoring-channel';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import { createCommands } from './commands.js';
import { subscribeMeasurements } from './measurements.js';
import {
  getCustomizationModule,
  LOG_PREFIX,
  readViewerVersion,
  type OhifCommandsManager,
  type OhifExtension,
  type OhifExtensionParams,
  type OhifServices,
  type OhifToolGroupService,
} from './ohif.js';

// Every OHIF extension registers under its package name; the id is written out rather than read
// from package.json, which a published bundle does not ship next to its modules.
export const SCORING_BRIDGE_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-bridge';

export interface ScoringBridgeExtensionOptions {
  // Overrides window.config.scoringBridge.hostOrigin, for a host that registers the extension
  // itself instead of through pluginConfig.json.
  hostOrigin?: string;
}

const VIEWER_VERSION = readViewerVersion() ?? 'unknown';

// A-9: setToolActive silently no-ops until a viewport has a tool group
// (commandsModule.ts:1050-1055), so the viewer announces itself on VIEWPORT_ADDED. The channel
// announces once; a later viewport only repeats the attempt if the first one found no host.
const announceOnViewport = (
  toolGroupService: OhifToolGroupService | undefined,
  channel: ViewerChannel,
): (() => void) => {
  const announce = (): void => {
    channel.announceReady({ viewerVersion: VIEWER_VERSION });
  };

  if (!toolGroupService) {
    console.warn(`${LOG_PREFIX} toolGroupService unavailable; announcing the viewer immediately`);
    announce();
    return (): void => undefined;
  }

  const subscription = toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, announce);

  return (): void => {
    subscription.unsubscribe();
  };
};

const startBridge = (
  services: OhifServices,
  commandsManager: OhifCommandsManager,
  hostOrigin: string,
): (() => void) => {
  const channel = createViewerChannel({ hostOrigin });
  const commands = createCommands(services, commandsManager, channel);
  const disposers = createDisposerSet({ logPrefix: LOG_PREFIX });

  const unsubscribeMeasurements = subscribeMeasurements(
    services.measurementService,
    channel,
    commands,
  );
  // Registered before the viewer announces itself, so no command can arrive unhandled (Q-1).
  const unsubscribeCommands = channel.onEach(commands.handlers);
  const unsubscribeAnnounce = announceOnViewport(services.toolGroupService, channel);

  // Release order is registration order (Q-5): the doctor's tool is restored first, then the OHIF
  // subscriptions go away, and the channel that carried all of it goes last.
  disposers.add(commands.dispose);
  disposers.add(unsubscribeMeasurements);
  disposers.add(unsubscribeCommands);
  disposers.add(unsubscribeAnnounce);
  disposers.add(channel.dispose);

  return disposers.dispose;
};

export const createScoringBridgeExtension = (
  options: ScoringBridgeExtensionOptions = {},
): OhifExtension => ({
  id: SCORING_BRIDGE_EXTENSION_ID,

  preRegistration: ({ servicesManager, commandsManager, appConfig }: OhifExtensionParams): void => {
    const hostOrigin = options.hostOrigin ?? appConfig?.scoringBridge?.hostOrigin;

    // Q-2: the origin is what every incoming message is checked against and the only targetOrigin
    // messages go out with, and '*' is never an option, so an unconfigured viewer runs unbridged.
    if (hostOrigin === undefined || hostOrigin.length === 0) {
      console.error(
        `${LOG_PREFIX} no host origin configured; set window.config.scoringBridge.hostOrigin to the embedding form's origin`,
      );
      return;
    }

    const dispose = startBridge(servicesManager.services, commandsManager, hostOrigin);

    // Q-5: onModeExit is a mode transition the bridge must outlive, and extensions have no
    // unregister hook, so the bridge is disposed with the page.
    const handlePageHide = (): void => {
      dispose();
      window.removeEventListener('pagehide', handlePageHide);
    };

    window.addEventListener('pagehide', handlePageHide);
  },

  getCustomizationModule,
});

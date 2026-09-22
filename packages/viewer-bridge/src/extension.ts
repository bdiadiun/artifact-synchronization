import { createDisposerSet, createViewerChannel } from '@bdiadiun/scoring-channel';
import type { ViewerChannel } from '@bdiadiun/scoring-channel';

import { createCommands } from './commands/handlers.js';
import { subscribeMeasurements } from './events/measurements.js';
import {
  getCustomizationModule,
  LOG_PREFIX,
  readViewerVersion,
  type OhifCommandsManager,
  type OhifExtension,
  type OhifExtensionParams,
  type OhifServices,
  type OhifToolGroupService,
} from './ohif/surface.js';

export const SCORING_BRIDGE_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-bridge';

export interface ScoringBridgeExtensionOptions {
  hostOrigin?: string;
}

const VIEWER_VERSION = readViewerVersion() ?? 'unknown';

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
  const unsubscribeCommands = channel.onEach(commands.handlers);
  const unsubscribeAnnounce = announceOnViewport(services.toolGroupService, channel);

  disposers.add(commands.dispose);
  disposers.add(unsubscribeMeasurements);
  disposers.add(unsubscribeCommands);
  disposers.add(unsubscribeAnnounce);
  disposers.add(channel.dispose);

  return disposers.dispose;
};

export const createScoringBridgeExtension = (
  options: ScoringBridgeExtensionOptions = {},
): OhifExtension => {
  const preRegistration = ({
    servicesManager,
    commandsManager,
    appConfig,
  }: OhifExtensionParams): void => {
    const hostOrigin = options.hostOrigin ?? appConfig?.scoringBridge?.hostOrigin;

    if (hostOrigin === undefined || hostOrigin.length === 0) {
      console.error(
        `${LOG_PREFIX} no host origin configured; set window.config.scoringBridge.hostOrigin to the embedding form's origin`,
      );
      return;
    }

    const dispose = startBridge(servicesManager.services, commandsManager, hostOrigin);

    const handlePageHide = (): void => {
      dispose();
      window.removeEventListener('pagehide', handlePageHide);
    };

    window.addEventListener('pagehide', handlePageHide);
  };

  return { id: SCORING_BRIDGE_EXTENSION_ID, preRegistration, getCustomizationModule };
};

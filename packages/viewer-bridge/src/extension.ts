import { createViewerChannel } from '@bdiadiun/scoring-channel';
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

const VIEWER_VERSION = readViewerVersion() ?? 'unknown';

const hasCornerstoneServices = (services: Partial<OhifServices>): services is OhifServices =>
  services.toolGroupService !== undefined && services.cornerstoneViewportService !== undefined;

const announceOnViewport = (
  toolGroupService: OhifToolGroupService,
  channel: ViewerChannel,
): (() => void) => {
  const announce = (): void => {
    channel.announceReady({ viewerVersion: VIEWER_VERSION });
  };

  const subscription = toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, announce);

  return (): void => {
    subscription.unsubscribe();
  };
};

const disposeAll = (disposers: (() => void)[]): void => {
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (error) {
      console.warn(`${LOG_PREFIX} disposer failed`, error);
    }
  }
};

const startBridge = (
  services: OhifServices,
  commandsManager: OhifCommandsManager,
  hostOrigin: string,
): (() => void) => {
  const channel = createViewerChannel({ hostOrigin });
  const commands = createCommands(services, commandsManager, channel);

  const unsubscribeMeasurements = subscribeMeasurements(
    services.measurementService,
    channel,
    commands,
  );
  const unsubscribeCommands = channel.onEach(commands.handlers);
  const unsubscribeAnnounce = announceOnViewport(services.toolGroupService, channel);

  const disposers = [
    commands.dispose,
    unsubscribeMeasurements,
    unsubscribeCommands,
    unsubscribeAnnounce,
    channel.dispose,
  ];

  return () => {
    disposeAll(disposers);
  };
};

export const createScoringBridgeExtension = (): OhifExtension => {
  const preRegistration = ({
    servicesManager,
    commandsManager,
    appConfig,
  }: OhifExtensionParams): void => {
    const hostOrigin = appConfig?.scoringBridge?.hostOrigin;

    if (hostOrigin === undefined || hostOrigin.length === 0) {
      console.error(
        `${LOG_PREFIX} no host origin configured; set window.config.scoringBridge.hostOrigin to the embedding form's origin`,
      );
      return;
    }

    const { services } = servicesManager;

    if (!hasCornerstoneServices(services)) {
      console.error(
        `${LOG_PREFIX} cornerstone services are not registered; is @ohif/extension-cornerstone listed before this extension?`,
      );
      return;
    }

    const dispose = startBridge(services, commandsManager, hostOrigin);

    const handlePageHide = (): void => {
      dispose();
      window.removeEventListener('pagehide', handlePageHide);
    };

    window.addEventListener('pagehide', handlePageHide);
  };

  return { id: SCORING_BRIDGE_EXTENSION_ID, preRegistration, getCustomizationModule };
};

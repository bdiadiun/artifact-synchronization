import { isHostCommand } from '@bdiadiun/scoring-contract';
import { createChannel } from '@bdiadiun/scoring-channel';

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
  type OhifSubscription,
  type OhifToolGroupService,
  type ViewerChannel,
} from './ohif/surface.js';

export const SCORING_BRIDGE_EXTENSION_ID = '@bdiadiun/ohif-extension-scoring-bridge';

const VIEWER_VERSION = readViewerVersion() ?? 'unknown';

const hasCornerstoneServices = (services: Partial<OhifServices>): services is OhifServices =>
  services.toolGroupService !== undefined && services.cornerstoneViewportService !== undefined;

const announceOnViewport = (
  toolGroupService: OhifToolGroupService,
  channel: ViewerChannel,
): (() => void) => {
  let subscription: OhifSubscription | null = null;

  const announceOnce = (): void => {
    if (subscription === null) {
      return;
    }
    subscription.unsubscribe();
    subscription = null;
    channel.send({ type: 'VIEWER_READY', viewerVersion: VIEWER_VERSION });
  };

  subscription = toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, announceOnce);

  return (): void => {
    subscription?.unsubscribe();
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
  const channel = createChannel({
    peerOrigin: hostOrigin,
    getPeerWindow: () => (window.parent === window ? null : window.parent),
    accept: isHostCommand,
  });
  const commands = createCommands(services, commandsManager, channel);

  const unsubscribeMeasurements = subscribeMeasurements(
    services.measurementService,
    channel,
    commands,
  );
  const unsubscribeAnnounce = announceOnViewport(services.toolGroupService, channel);

  channel.onMessage(commands.handleCommand);

  const disposers = [
    commands.dispose,
    unsubscribeMeasurements,
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

import { createContext, type JSX, type ReactNode } from 'react';
import { useScoringBridge } from './hooks/useScoringBridge.js';
import { createOhif } from './ohif/facade.js';
import {
  LOG_PREFIX,
  type OhifContextModuleEntry,
  type OhifExtensionParams,
  type OhifServices,
  type ViewerChannel,
} from './ohif/surface.js';

const ScoringBridgeContext = createContext<ViewerChannel | null>(null);

const hasCornerstoneServices = (services: Partial<OhifServices>): services is OhifServices =>
  services.toolGroupService !== undefined && services.cornerstoneViewportService !== undefined;

export const getContextModule = ({
  appConfig,
  servicesManager,
  commandsManager,
}: OhifExtensionParams): OhifContextModuleEntry[] => {
  const hostOrigin = appConfig?.scoringBridge?.hostOrigin;
  const { services } = servicesManager;

  if (hostOrigin === undefined || hostOrigin.length === 0) {
    console.error(
      `${LOG_PREFIX} no host origin configured; set window.config.scoringBridge.hostOrigin to the embedding form's origin`,
    );
    return [];
  }

  if (!hasCornerstoneServices(services)) {
    console.error(
      `${LOG_PREFIX} cornerstone services are not registered; is @ohif/extension-cornerstone listed before this extension?`,
    );
    return [];
  }

  const ohif = createOhif(services, commandsManager);
  const ScoringBridge = ({ children }: { children?: ReactNode }): JSX.Element => {
    const channel = useScoringBridge(hostOrigin, ohif);

    return (
      <ScoringBridgeContext.Provider value={channel}>{children}</ScoringBridgeContext.Provider>
    );
  };

  return [{ name: 'ScoringBridge', context: ScoringBridgeContext, provider: ScoringBridge }];
};

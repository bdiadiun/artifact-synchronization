import { createContext, type JSX, type ReactNode } from 'react';
import { useScoringViewer } from './hooks/useScoringViewer.js';
import { createOhif } from './ohif/facade.js';
import {
  LOG_PREFIX,
  type OhifContextModuleEntry,
  type OhifExtensionParams,
  type OhifServices,
  type ViewerChannel,
} from './ohif/surface.js';

const ScoringViewerContext = createContext<ViewerChannel | null>(null);

const hasCornerstoneServices = (services: Partial<OhifServices>): services is OhifServices =>
  services.toolGroupService !== undefined && services.cornerstoneViewportService !== undefined;

export const getContextModule = ({
  appConfig,
  servicesManager,
  commandsManager,
}: OhifExtensionParams): OhifContextModuleEntry[] => {
  const hostOrigin = appConfig?.scoringViewer?.hostOrigin;
  const { services } = servicesManager;

  if (hostOrigin === undefined || hostOrigin.length === 0) {
    console.error(
      `${LOG_PREFIX} no host origin configured; set window.config.scoringViewer.hostOrigin to the embedding form's origin`,
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
  const ScoringViewer = ({ children }: { children?: ReactNode }): JSX.Element => {
    const channel = useScoringViewer(hostOrigin, ohif);

    return <ScoringViewerContext.Provider value={channel}>{children}</ScoringViewerContext.Provider>;
  };

  return [{ name: 'ScoringViewer', context: ScoringViewerContext, provider: ScoringViewer }];
};

import { createContext, type JSX, type ReactNode } from 'react';
import type { Ohif } from './bridge.js';
import { useScoringBridge } from './hooks/useScoringBridge.js';
import {
  LOG_PREFIX,
  type OhifContextModuleEntry,
  type OhifExtensionParams,
  type OhifServices,
} from './ohif/surface.js';

const ScoringBridgeContext = createContext<null>(null);

const hasCornerstoneServices = (services: Partial<OhifServices>): services is OhifServices =>
  services.toolGroupService !== undefined && services.cornerstoneViewportService !== undefined;

interface ScoringBridgeProps {
  hostOrigin: string;
  ohif: Ohif;
  children?: ReactNode;
}

const ScoringBridge = ({ hostOrigin, ohif, children }: ScoringBridgeProps): JSX.Element => {
  useScoringBridge(hostOrigin, ohif);

  return <>{children}</>;
};

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

  const ohif: Ohif = { services, commandsManager };
  const provider = ({ children }: { children?: ReactNode }): JSX.Element => (
    <ScoringBridge hostOrigin={hostOrigin} ohif={ohif}>
      {children}
    </ScoringBridge>
  );

  return [{ name: 'ScoringBridge', context: ScoringBridgeContext, provider }];
};

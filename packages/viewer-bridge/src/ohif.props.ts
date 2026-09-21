// The OHIF surface this extension consumes, declared by the consumer. No OHIF package publishes
// type declarations and the viewer's global `AppTypes` only resolves inside the OHIF monorepo, so
// every member below is one this bridge actually calls; a service is optional because
// `servicesManager.services` is a registry and an unregistered service is simply absent.

import type { OhifExtension as OhifExtensionLike } from './extension.props.js';
import type { OhifMeasurementLike } from './measurements.props.js';

export interface OhifSubscription {
  unsubscribe: () => void;
}

export interface OhifMeasurementServiceEvents {
  MEASUREMENT_ADDED: string;
  MEASUREMENT_UPDATED: string;
  MEASUREMENT_REMOVED: string;
}

// MEASUREMENT_ADDED and MEASUREMENT_UPDATED carry the measurement, MEASUREMENT_REMOVED carries
// only its uid (MeasurementService.ts:686-689), so each handler narrows the payload it reads.
export interface OhifMeasurementEvent {
  measurement: OhifMeasurementLike | string;
}

export interface OhifMeasurementService {
  EVENTS: OhifMeasurementServiceEvents;
  subscribe: (
    eventName: string,
    handler: (event: OhifMeasurementEvent) => void,
  ) => OhifSubscription;
  getMeasurement: (measurementUid: string) => OhifMeasurementLike | undefined;
  remove: (measurementUid: string) => void;
  jumpToMeasurement: (viewportId: string, measurementUid: string) => void;
}

export interface OhifToolGroup {
  id: string;
  hasTool: (toolName: string) => boolean;
}

export interface OhifToolGroupServiceEvents {
  VIEWPORT_ADDED: string;
}

export interface OhifToolGroupService {
  EVENTS: OhifToolGroupServiceEvents;
  subscribe: (eventName: string, handler: () => void) => OhifSubscription;
  // Without an id this resolves the active viewport's group (ToolGroupService.ts:73-104).
  getToolGroup: () => OhifToolGroup | undefined;
  getActivePrimaryMouseButtonTool: () => string | undefined;
}

export interface OhifCornerstoneViewportServiceEvents {
  VIEWPORT_DATA_CHANGED: string;
}

export interface OhifCornerstoneViewportService {
  EVENTS: OhifCornerstoneViewportServiceEvents;
  subscribe: (eventName: string, handler: () => void) => OhifSubscription;
  // Only its presence is read, never its members: it reports that the viewport holds data.
  getCornerstoneViewport: (viewportId: string) => object | null | undefined;
}

export interface OhifViewportGridService {
  getActiveViewportId: () => string;
}

export interface OhifDisplaySet {
  StudyInstanceUID: string;
}

export interface OhifDisplaySetService {
  getActiveDisplaySets: () => OhifDisplaySet[];
}

export interface OhifServices {
  measurementService?: OhifMeasurementService;
  toolGroupService?: OhifToolGroupService;
  cornerstoneViewportService?: OhifCornerstoneViewportService;
  viewportGridService?: OhifViewportGridService;
  displaySetService?: OhifDisplaySetService;
}

export interface OhifServicesManager {
  services: OhifServices;
}

export interface OhifCommandsManager {
  runCommand: (commandName: string, options?: Record<string, unknown>) => unknown;
}

// The place a deployment supplies the embedding form's origin: `window.config`, which OHIF hands
// to every extension (ExtensionManager.ts:276-286), so no fork file carries this deployment's URL.
export interface ScoringBridgeAppConfig {
  scoringBridge?: {
    hostOrigin?: string;
  };
}

// The manager itself is among the pre-registration arguments and its registerExtension is public
// and re-entrant (ExtensionManager.ts:251-286), which is how the adapter registers our extensions.
// Declared here, in the one file that describes the OHIF surface we call, rather than a second time
// in the adapter package. The extension shape is the adapter's children, hence the forward type.
export interface OhifExtensionManager {
  registerExtension: (extension: OhifExtensionLike) => Promise<void>;
}

export interface OhifExtensionParams {
  servicesManager: OhifServicesManager;
  commandsManager: OhifCommandsManager;
  extensionManager?: OhifExtensionManager;
  appConfig?: ScoringBridgeAppConfig;
}

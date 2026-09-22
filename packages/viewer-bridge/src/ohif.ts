// Everything this extension knows about OHIF: the surface it calls, declared by the consumer,
// plus the two values that only exist because OHIF provides them — the viewer's own version and
// the overlay that shows it (S-5.5). No OHIF package publishes type declarations and the viewer's
// global `AppTypes` only resolves inside the OHIF monorepo, so every member below is one this
// bridge actually calls; a service is optional because `servicesManager.services` is a registry
// and an unregistered service is simply absent.

// One prefix for everything this extension writes into the viewer's console; the conversation
// itself is logged by the channel under its own prefix.
export const LOG_PREFIX = '[scoring-bridge]';

export interface OhifSubscription {
  unsubscribe: () => void;
}

// cachedStats keyed per render target, normally `imageId:<referencedImageId>`
// (measurementServiceMappings/EllipticalROI.ts:110); no top-level area.
export type StatsEntry = Record<string, unknown>;

export interface OhifMeasurementLike {
  uid?: string;
  toolName?: string;
  referencedImageId?: string;
  data?: Record<string, StatsEntry | undefined> | null;
  // A-14 restore inputs; `metadata` is the cornerstone annotation metadata by reference.
  points?: unknown;
  label?: string;
  metadata?: { FrameOfReferenceUID?: string } | null;
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

// The three members ExtensionManager reads from an extension: the id it registers modules under
// (ExtensionManager.ts:260-273), the pre-registration hook and one module getter.
export interface OhifExtension {
  id: string;
  preRegistration: (params: OhifExtensionParams) => void;
  // Read only when the extension declares one (ExtensionManager.ts:297-341), which an extension
  // that contributes no module does not.
  getCustomizationModule?: () => CustomizationModuleEntry[];
}

// The manager awaits the hook (ExtensionManager.ts:277), so an extension whose pre-registration is
// asynchronous is registered before the application finishes starting.
export interface OhifAsyncExtension extends Omit<OhifExtension, 'preRegistration'> {
  preRegistration: (params: OhifExtensionParams) => Promise<void>;
}

// The manager itself is among the pre-registration arguments and its registerExtension is public
// and re-entrant (ExtensionManager.ts:251-286), which is how the adapter registers our extensions.
export interface OhifExtensionManager {
  registerExtension: (extension: OhifExtension) => Promise<void>;
}

export interface OhifExtensionParams {
  servicesManager: OhifServicesManager;
  commandsManager: OhifCommandsManager;
  extensionManager?: OhifExtensionManager;
  appConfig?: ScoringBridgeAppConfig;
}

export interface OverlayItemCustomization {
  id: string;
  inheritsFrom: string;
  title: string;
  contentF: () => string | null;
}

export interface CustomizationModuleEntry {
  name: string;
  value: Record<string, { $push: OverlayItemCustomization[] }>;
}

// OHIF's webpack replaces this exact expression with the contents of platform/app/version.txt at
// build time (.webpack/webpack.base.js:32,46); `process` itself never exists in the browser, so the
// expression is written the way DefinePlugin matches it and nowhere else.
declare const process: { env: { VERSION_NUMBER?: string } };

export const readViewerVersion = (): string | undefined => process.env.VERSION_NUMBER;

const VERSION_NUMBER = readViewerVersion() ?? '';

// Least crowded corner; top-right is empty but hosts the viewport action menus.
const VERSION_OVERLAY_CUSTOMIZATION_ID = 'viewportOverlay.bottomRight';

const versionOverlayItem: OverlayItemCustomization = {
  id: 'scoringBridgeVersion',
  inheritsFrom: 'ohif.overlayItem',
  title: 'OHIF viewer version',
  // contentF, not `label`: one text node (CustomizableViewportOverlay.tsx:380-397).
  contentF: () => (VERSION_NUMBER ? `OHIF ${VERSION_NUMBER}` : null),
};

export const getCustomizationModule = (): CustomizationModuleEntry[] => [
  {
    // Merged in registration order after cornerstone, so $push appends to its overlay list
    // (CustomizationService.ts:118-131,381-397).
    name: 'default',
    value: {
      [VERSION_OVERLAY_CUSTOMIZATION_ID]: {
        $push: [versionOverlayItem],
      },
    },
  },
];

import { z } from 'zod';

export const LOG_PREFIX = '[scoring-bridge]';

export interface OhifSubscription {
  unsubscribe: () => void;
}

export const StatsEntry = z.record(z.string(), z.unknown());
export type StatsEntry = z.infer<typeof StatsEntry>;

export const OhifMeasurement = z.object({
  uid: z.string().min(1),
  toolName: z.string(),
  referencedImageId: z.string().optional(),
  label: z.string().optional(),
  metadata: z.object({ FrameOfReferenceUID: z.string().optional() }).nullish(),
  points: z.array(z.array(z.number())).optional(),
  data: z.record(z.string(), StatsEntry.optional()).nullish(),
});
export type OhifMeasurement = z.infer<typeof OhifMeasurement>;

export interface OhifMeasurementServiceEvents {
  MEASUREMENT_ADDED: string;
  MEASUREMENT_UPDATED: string;
  MEASUREMENT_REMOVED: string;
}

export interface OhifMeasurementEvent {
  measurement: unknown;
}

export interface OhifMeasurementService {
  EVENTS: OhifMeasurementServiceEvents;
  subscribe: (
    eventName: string,
    handler: (event: OhifMeasurementEvent) => void,
  ) => OhifSubscription;
  getMeasurement: (measurementUid: string) => unknown;
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
  getToolGroup: () => OhifToolGroup | undefined;
}

export interface OhifCornerstoneViewportServiceEvents {
  VIEWPORT_DATA_CHANGED: string;
}

export interface OhifCornerstoneViewportService {
  EVENTS: OhifCornerstoneViewportServiceEvents;
  subscribe: (eventName: string, handler: () => void) => OhifSubscription;
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
  measurementService: OhifMeasurementService;
  toolGroupService: OhifToolGroupService;
  cornerstoneViewportService: OhifCornerstoneViewportService;
  viewportGridService: OhifViewportGridService;
  displaySetService: OhifDisplaySetService;
}

export interface OhifServicesManager {
  services: Partial<OhifServices>;
}

export interface OhifCommandsManager {
  runCommand: (commandName: string, options?: Record<string, unknown>) => unknown;
}

export interface ScoringBridgeAppConfig {
  scoringBridge?: {
    hostOrigin?: string;
  };
}

export interface OhifExtension {
  id: string;
  preRegistration: (params: OhifExtensionParams) => void;
  getCustomizationModule?: () => CustomizationModuleEntry[];
}

export interface OhifAsyncExtension extends Omit<OhifExtension, 'preRegistration'> {
  preRegistration: (params: OhifExtensionParams) => Promise<void>;
}

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

// OHIF's webpack replaces this exact expression at build time (webpack.base.js:32,46).
declare const process: { env: { VERSION_NUMBER?: string } };

export const readViewerVersion = (): string | undefined => process.env.VERSION_NUMBER;

const VERSION_NUMBER = readViewerVersion() ?? '';

const VERSION_OVERLAY_CUSTOMIZATION_ID = 'viewportOverlay.bottomRight';

const versionOverlayText = (): string | null => (VERSION_NUMBER ? `OHIF ${VERSION_NUMBER}` : null);

const versionOverlayItem: OverlayItemCustomization = {
  id: 'scoringBridgeVersion',
  inheritsFrom: 'ohif.overlayItem',
  title: 'OHIF viewer version',
  contentF: versionOverlayText,
};

export const getCustomizationModule = (): CustomizationModuleEntry[] => [
  {
    name: 'default',
    value: {
      [VERSION_OVERLAY_CUSTOMIZATION_ID]: {
        $push: [versionOverlayItem],
      },
    },
  },
];

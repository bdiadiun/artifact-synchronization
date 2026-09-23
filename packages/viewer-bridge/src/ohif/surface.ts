import type { ComponentType, Context, ReactNode } from 'react';
import type { HostCommand } from '@bdiadiun/scoring-contract';
import type { Channel } from '@bdiadiun/scoring-channel';

export type ViewerChannel = Channel<HostCommand>;

export const LOG_PREFIX = '[scoring-bridge]';

export interface OhifSubscription {
  unsubscribe: () => void;
}

interface OhifMeasurementServiceEvents {
  MEASUREMENT_ADDED: string;
  MEASUREMENT_UPDATED: string;
  MEASUREMENT_REMOVED: string;
}

export interface OhifMeasurementEvent {
  measurement: unknown;
}

export interface OhifMeasurementService {
  EVENTS: OhifMeasurementServiceEvents;
  subscribe: (eventName: string, handler: (event: OhifMeasurementEvent) => void) => OhifSubscription;
  getMeasurement: (measurementUid: string) => unknown;
  remove: (measurementUid: string) => void;
  jumpToMeasurement: (viewportId: string, measurementUid: string) => void;
}

interface OhifToolGroup {
  id: string;
  hasTool: (toolName: string) => boolean;
}

interface OhifToolGroupServiceEvents {
  VIEWPORT_ADDED: string;
}

export interface OhifToolGroupService {
  EVENTS: OhifToolGroupServiceEvents;
  subscribe: (eventName: string, handler: () => void) => OhifSubscription;
  getToolGroup: () => OhifToolGroup | undefined;
}

interface OhifCornerstoneViewportServiceEvents {
  VIEWPORT_DATA_CHANGED: string;
}

interface OhifCornerstoneViewportService {
  EVENTS: OhifCornerstoneViewportServiceEvents;
  subscribe: (eventName: string, handler: () => void) => OhifSubscription;
  getCornerstoneViewport: (viewportId: string) => object | null | undefined;
}

interface OhifViewportGridService {
  getActiveViewportId: () => string;
}

interface OhifDisplaySet {
  StudyInstanceUID: string;
}

interface OhifDisplaySetService {
  getActiveDisplaySets: () => OhifDisplaySet[];
}

export interface OhifServices {
  measurementService: OhifMeasurementService;
  toolGroupService: OhifToolGroupService;
  cornerstoneViewportService: OhifCornerstoneViewportService;
  viewportGridService: OhifViewportGridService;
  displaySetService: OhifDisplaySetService;
}

interface OhifServicesManager {
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

export interface OhifContextModuleEntry {
  name: string;
  context: Context<ViewerChannel | null>;
  provider: ComponentType<{ children?: ReactNode }>;
}

export interface OhifExtension {
  id: string;
  preRegistration?: (params: OhifExtensionParams) => void | Promise<void>;
  getContextModule?: (params: OhifExtensionParams) => OhifContextModuleEntry[];
  getCustomizationModule?: () => CustomizationModuleEntry[];
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

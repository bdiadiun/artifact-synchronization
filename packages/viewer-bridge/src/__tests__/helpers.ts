import { vi } from 'vitest';

import type { OhifServices } from '../ohif/surface.js';

export const VIEWPORT_ID = 'viewport-1';
export const STUDY_UID = 'study-1';

export const createServices = (overrides: Partial<OhifServices> = {}): OhifServices => ({
  measurementService: {
    EVENTS: {
      MEASUREMENT_ADDED: 'MEASUREMENT_ADDED',
      MEASUREMENT_UPDATED: 'MEASUREMENT_UPDATED',
      MEASUREMENT_REMOVED: 'MEASUREMENT_REMOVED',
    },
    subscribe: () => ({ unsubscribe: vi.fn() }),
    getMeasurement: vi.fn(),
    remove: vi.fn(),
    jumpToMeasurement: vi.fn(),
  },
  toolGroupService: {
    EVENTS: { VIEWPORT_ADDED: 'VIEWPORT_ADDED' },
    subscribe: () => ({ unsubscribe: vi.fn() }),
    getToolGroup: () => ({ id: 'group-1', hasTool: () => true }),
  },
  cornerstoneViewportService: {
    EVENTS: { VIEWPORT_DATA_CHANGED: 'VIEWPORT_DATA_CHANGED' },
    subscribe: () => ({ unsubscribe: vi.fn() }),
    getCornerstoneViewport: () => ({}),
  },
  viewportGridService: { getActiveViewportId: () => VIEWPORT_ID },
  displaySetService: { getActiveDisplaySets: () => [{ StudyInstanceUID: STUDY_UID }] },
  ...overrides,
});

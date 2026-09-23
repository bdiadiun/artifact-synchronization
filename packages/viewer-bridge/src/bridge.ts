import type { RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from './ohif/surface.js';

export interface Bridge {
  channel: ViewerChannel;
  armedRowId: string | null;
  pendingRestore: RestoreMeasurementsCommand | null;
  announced: boolean;
}

export const createBridge = (channel: ViewerChannel): Bridge => ({
  channel,
  armedRowId: null,
  pendingRestore: null,
  announced: false,
});

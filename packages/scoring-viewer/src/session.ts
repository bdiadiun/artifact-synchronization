import type { RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import type { ViewerChannel } from './ohif/surface.js';

export interface Session {
  channel: ViewerChannel;
  armedRowId: string | null;
  pendingRestore: RestoreMeasurementsCommand | null;
  announced: boolean;
}

export const createSession = (channel: ViewerChannel): Session => ({
  channel,
  armedRowId: null,
  pendingRestore: null,
  announced: false,
});

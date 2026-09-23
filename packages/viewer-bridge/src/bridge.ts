import { isHostCommand, type RestoreMeasurementsCommand } from '@bdiadiun/scoring-contract';
import { createChannel } from '@bdiadiun/scoring-channel';
import type { OhifCommandsManager, OhifServices, ViewerChannel } from './ohif/surface.js';

export interface Ohif {
  services: OhifServices;
  commandsManager: OhifCommandsManager;
}

export interface Bridge {
  channel: ViewerChannel;
  armedRowId: string | null;
  pendingRestore: RestoreMeasurementsCommand | null;
}

export const createBridge = (hostOrigin: string): Bridge => ({
  channel: createChannel({
    peerOrigin: hostOrigin,
    accept: isHostCommand,
    peerWindow: window.parent,
  }),
  armedRowId: null,
  pendingRestore: null,
});

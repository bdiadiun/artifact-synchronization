import type { Bridge } from '../bridge.js';
import { activateTool, DEFAULT_TOOL } from '../commands/handlers.js';
import { restorePending } from '../commands/restore.js';
import type { Ohif, OhifEvent } from '../ohif/facade.js';

export const handleOhif = (ohif: Ohif, bridge: Bridge, event: OhifEvent): void => {
  switch (event.type) {
    case 'MEASUREMENT_ADDED': {
      const rowId = bridge.armedRowId;
      bridge.armedRowId = null;
      bridge.channel.send({ ...event, rowId });

      if (rowId !== null) {
        activateTool(ohif, DEFAULT_TOOL);
      }
      break;
    }
    case 'MEASUREMENT_UPDATED':
    case 'MEASUREMENT_REMOVED':
      bridge.channel.send(event);
      break;
    case 'VIEWER_READY':
      if (!bridge.announced) {
        bridge.announced = true;
        bridge.channel.send(event);
      }
      break;
    case 'VIEWPORT_DATA_CHANGED':
      restorePending(ohif, bridge);
      break;
  }
};

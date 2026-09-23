import type { Session } from '../session.js';
import { activateTool, DEFAULT_TOOL } from '../commands/handlers.js';
import { restorePending } from '../commands/restore.js';
import type { Ohif, OhifEvent } from '../ohif/facade.js';

export const handleOhif = (ohif: Ohif, session: Session, event: OhifEvent): void => {
  switch (event.type) {
    case 'MEASUREMENT_ADDED': {
      const rowId = session.armedRowId;
      session.armedRowId = null;
      session.channel.send({ ...event, rowId });

      if (rowId !== null) {
        activateTool(ohif, DEFAULT_TOOL);
      }
      break;
    }
    case 'MEASUREMENT_UPDATED':
    case 'MEASUREMENT_REMOVED':
      session.channel.send(event);
      break;
    case 'VIEWER_READY':
      if (!session.announced) {
        session.announced = true;
        session.channel.send(event);
      }
      break;
    case 'VIEWPORT_DATA_CHANGED':
      restorePending(ohif, session);
      break;
  }
};

import { useEffect, useState } from 'react';
import { isHostCommand } from '@bdiadiun/scoring-contract';
import { useChannel } from '@bdiadiun/scoring-channel';
import { createSession } from '../session.js';
import { handleCommand } from '../commands/handlers.js';
import { handleOhif } from '../events/handlers.js';
import type { Ohif } from '../ohif/facade.js';
import type { ViewerChannel } from '../ohif/surface.js';

export const useScoringViewer = (hostOrigin: string, ohif: Ohif): ViewerChannel => {
  const channel = useChannel({
    peerOrigin: hostOrigin,
    accept: isHostCommand,
    peerWindow: window.parent === window ? undefined : window.parent,
  });
  const [session] = useState(() => createSession(channel));

  useEffect(
    () =>
      channel.on((command) => {
        handleCommand(ohif, session, command);
      }),
    [channel, ohif, session],
  );

  useEffect(
    () =>
      ohif.on((event) => {
        handleOhif(ohif, session, event);
      }),
    [ohif, session],
  );

  return channel;
};

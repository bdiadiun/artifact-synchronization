import { useEffect, useState } from 'react';
import { isHostCommand } from '@bdiadiun/scoring-contract';
import { useChannel } from '@bdiadiun/scoring-channel';
import { createBridge } from '../bridge.js';
import { handleCommand } from '../commands/handlers.js';
import { handleOhif } from '../events/handlers.js';
import type { Ohif } from '../ohif/facade.js';
import type { ViewerChannel } from '../ohif/surface.js';

export const useScoringBridge = (hostOrigin: string, ohif: Ohif): ViewerChannel => {
  const channel = useChannel({
    peerOrigin: hostOrigin,
    accept: isHostCommand,
    peerWindow: window.parent === window ? undefined : window.parent,
  });
  const [bridge] = useState(() => createBridge(channel));

  useEffect(
    () =>
      channel.on((command) => {
        handleCommand(ohif, bridge, command);
      }),
    [channel, ohif, bridge],
  );

  useEffect(
    () =>
      ohif.on((event) => {
        handleOhif(ohif, bridge, event);
      }),
    [ohif, bridge],
  );

  return channel;
};

import { useEffect, useState } from 'react';
import { createBridge, type Ohif } from '../bridge.js';
import { handleCommand } from '../commands/handlers.js';
import { subscribeViewportData } from '../commands/restore.js';
import { announceOnViewport } from '../events/announce.js';
import { subscribeMeasurements } from '../events/measurements.js';

// The bridge's lifetime is this hook's: the channel and the two pieces of state are created once
// per mount, and every subscription below is released by its effect's cleanup (Q-5).
export const useScoringBridge = (hostOrigin: string, ohif: Ohif): void => {
  const [bridge] = useState(() => createBridge(hostOrigin));

  useEffect(() => bridge.channel.dispose, [bridge]);

  useEffect(
    () =>
      bridge.channel.onMessage((command) => {
        handleCommand(ohif, bridge, command);
      }),
    [ohif, bridge],
  );

  useEffect(() => subscribeMeasurements(ohif, bridge), [ohif, bridge]);

  useEffect(() => subscribeViewportData(ohif, bridge), [ohif, bridge]);

  useEffect(
    () => announceOnViewport(ohif.services.toolGroupService, bridge.channel),
    [ohif, bridge],
  );
};

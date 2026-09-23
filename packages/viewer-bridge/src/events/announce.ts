import type { OhifToolGroupService, ViewerChannel } from '../ohif/surface.js';
import { VIEWER_VERSION } from '../ohif/version.js';

export const announceOnViewport = (
  toolGroupService: OhifToolGroupService,
  channel: ViewerChannel,
): (() => void) => {
  const announce = (): void => {
    channel.send({ type: 'VIEWER_READY', viewerVersion: VIEWER_VERSION });
  };

  if (toolGroupService.getToolGroup() !== undefined) {
    announce();
    return (): void => undefined;
  }

  const subscription = toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, () => {
    subscription.unsubscribe();
    announce();
  });

  return (): void => {
    subscription.unsubscribe();
  };
};

import { isHostCommand } from '@bdiadiun/scoring-contract';

import { LOG_PREFIX } from './config.js';
import type { CommandListener, CommandListenerDeps, PostToHost } from './messaging.props.js';

export const createPostToHost =
  (hostOrigin: string): PostToHost =>
  (message) => {
    if (window.parent === window) {
      console.debug(`${LOG_PREFIX} not embedded in an iframe -> skip ${message.type}`);
      return false;
    }

    window.parent.postMessage(message, hostOrigin);
    return true;
  };

export const createCommandListener = ({
  hostOrigin,
  onCommand,
}: CommandListenerDeps): CommandListener => {
  // Q-2: only the configured host origin may command the viewer. Logged once, so a misconfigured
  // origin is diagnosable without flooding from browser extensions or HMR clients.
  let foreignOriginLogged = false;

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== hostOrigin) {
      if (!foreignOriginLogged) {
        foreignOriginLogged = true;
        console.debug(
          `${LOG_PREFIX} ignoring message from foreign origin ${event.origin}; expected ${hostOrigin}`,
        );
      }
      return;
    }

    if (!isHostCommand(event.data)) {
      console.warn(`${LOG_PREFIX} ignoring message that is not a valid host command`, event.data);
      return;
    }

    onCommand(event.data);
  };

  window.addEventListener('message', onMessage);

  return {
    dispose: (): void => {
      window.removeEventListener('message', onMessage);
    },
  };
};

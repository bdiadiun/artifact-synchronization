import { useLayoutEffect, useState, type RefObject } from 'react';
import { createHostChannel, type HostChannel } from '@bdiadiun/scoring-channel';
import { VIEWER_ORIGIN } from '@app/config';

// A layout effect, not a passive one: on unmount React clears the iframe ref and removes the element
// before passive cleanups run, and the cancelling DEACTIVATE_TOOL (Q-5) would find no window to go
// to. A layout cleanup still sees the mounted iframe.
// One channel per mount, disposed in this effect's cleanup; under StrictMode's dev double-mount the
// first mount's cleanup runs before the second mount attaches, so only one listener is ever live.
export const useHostChannel = (
  iframeRef: RefObject<HTMLIFrameElement | null>,
): HostChannel | null => {
  const [channel, setChannel] = useState<HostChannel | null>(null);

  useLayoutEffect(() => {
    const created = createHostChannel({
      viewerOrigin: VIEWER_ORIGIN,
      // Read lazily: the iframe can be briefly null and its window is a live value (P-1).
      getViewerWindow: () => iframeRef.current?.contentWindow ?? null,
    });
    setChannel(created);

    return () => {
      setChannel(null);
      // Q-5: the armed tool is cancelled from in here, while the channel is still live.
      created.dispose();
    };
  }, [iframeRef]);

  return channel;
};

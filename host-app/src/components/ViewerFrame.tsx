import { forwardRef } from 'react';
import { UI } from '../ui-strings';
import { viewerUrl } from '../config';

// No `sandbox` attribute: the viewer needs its own scripts and must be able to postMessage out.
export const ViewerFrame = forwardRef<HTMLIFrameElement>(function ViewerFrame(_props, ref) {
  return (
    <iframe
      ref={ref}
      title={UI.viewerFrameTitle}
      src={viewerUrl()}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
});

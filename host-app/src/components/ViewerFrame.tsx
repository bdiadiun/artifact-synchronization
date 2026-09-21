import { forwardRef, type JSX } from 'react';
import { t } from '@app/i18n';
import { viewerUrl } from '@app/config';
import { styles } from './ViewerFrame.props';

// No `sandbox` attribute: the viewer needs its own scripts and must be able to postMessage out.
export const ViewerFrame = forwardRef<HTMLIFrameElement>((_props, ref): JSX.Element => {
  return <iframe ref={ref} title={t.viewerFrameTitle} src={viewerUrl()} style={styles.frame} />;
});

import type { JSX } from 'react';
import { t } from '@app/i18n';
import { viewerUrl } from '@app/config';
import { styles } from './ViewerFrame.props';

export const ViewerFrame = (): JSX.Element => (
  <iframe title={t.viewerFrameTitle} src={viewerUrl()} style={styles.frame} />
);

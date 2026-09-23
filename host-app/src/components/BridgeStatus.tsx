import type { JSX } from 'react';
import { t } from '@app/i18n';
import { styles, type BridgeStatusProps } from './BridgeStatus.props';

export const BridgeStatus = ({ state }: BridgeStatusProps): JSX.Element => {
  const readiness = state.ready ? t.bridgeReady : t.bridgeNotReady;

  return (
    <div style={styles.status}>
      {t.bridgeStatus}: {readiness}, {t.bridgeQueued}: {state.queued}
    </div>
  );
};

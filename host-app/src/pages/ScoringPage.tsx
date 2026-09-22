import { useRef, type JSX } from 'react';
import { BridgeStatus } from '@app/components/BridgeStatus';
import { ScoringPanel } from '@app/components/ScoringPanel';
import { ViewerFrame } from '@app/components/ViewerFrame';
import { useChannelState, useHostChannel } from '@app/channel/useHostChannel';
import { useScoringForm } from '@app/form/useScoringForm';

export const ScoringPage = (): JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const channel = useHostChannel(iframeRef);
  const channelState = useChannelState(channel);
  const { rows, addRow, activate, cancel, remove, focus } = useScoringForm(channel);

  return (
    <div className="layout">
      <div className="layout__viewer">
        <ViewerFrame ref={iframeRef} />
      </div>
      <div className="layout__panel">
        <BridgeStatus state={channelState} />
        <ScoringPanel
          rows={rows}
          addRow={addRow}
          activate={activate}
          cancel={cancel}
          remove={remove}
          focus={focus}
        />
      </div>
    </div>
  );
};

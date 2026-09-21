import { useRef, type JSX } from 'react';
import { BridgeStatus } from '@app/components/BridgeStatus';
import { ScoringPanel } from '@app/components/ScoringPanel';
import { ViewerFrame } from '@app/components/ViewerFrame';
import { useBridge } from '@app/hooks/useBridge';
import { useScoringForm } from '@app/hooks/useScoringForm';

export const ScoringPage = (): JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { send, state } = useBridge(iframeRef);
  const { rows, addRow, activate, cancel, remove, focus } = useScoringForm({
    send,
    lastEvent: state.lastEvent,
  });

  return (
    <div className="layout">
      <div className="layout__viewer">
        <ViewerFrame ref={iframeRef} />
      </div>
      <div className="layout__panel">
        <BridgeStatus state={state} />
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

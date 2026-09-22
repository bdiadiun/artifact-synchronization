import { useCallback, useLayoutEffect, useRef, type JSX } from 'react';
import { BridgeStatus } from '@app/components/BridgeStatus';
import { ScoringPanel } from '@app/components/ScoringPanel';
import { ViewerFrame } from '@app/components/ViewerFrame';
import { useChannelState, useHostChannel } from '@app/channel/useHostChannel';
import { findDrawingRow, type Row } from '@app/form/rows';
import { useScoringForm } from '@app/form/useScoringForm';

export const ScoringPage = (): JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // The rows as last rendered, for the unmount cleanup that cancels the drawing row (Q-5).
  const rowsRef = useRef<Row[]>([]);
  const getDrawingRowId = useCallback(() => findDrawingRow(rowsRef.current)?.rowId ?? null, []);
  const channel = useHostChannel(iframeRef, getDrawingRowId);
  const channelState = useChannelState(channel);
  const { rows, addRow, activate, cancel, remove, focus } = useScoringForm(channel);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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

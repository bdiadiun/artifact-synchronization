import { useRef } from 'react';
import { ViewerFrame } from './components/ViewerFrame';
import { ScoringPanel } from './components/ScoringPanel';
import { BridgeStatus } from './components/BridgeStatus';
import { useBridge } from './bridge/useBridge';
import { useScoringForm } from './form/useScoringForm';
import './App.css';

function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { send, state } = useBridge(iframeRef);
  const { rows, addRow, activate, cancel, remove, focus } = useScoringForm({ send, lastEvent: state.lastEvent });

  return (
    <div className="layout">
      <div className="layout__viewer">
        <ViewerFrame ref={iframeRef} />
      </div>
      <div className="layout__panel">
        <BridgeStatus state={state} />
        <ScoringPanel rows={rows} addRow={addRow} activate={activate} cancel={cancel} remove={remove} focus={focus} />
      </div>
    </div>
  );
}

export default App;

import { useRef } from 'react';
import { ViewerFrame } from './components/ViewerFrame';
import { ScoringPanel } from './components/ScoringPanel';
import { BridgeStatus } from './components/BridgeStatus';
import { useBridge } from './bridge/useBridge';
import './App.css';

function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { state } = useBridge(iframeRef);

  return (
    <div className="layout">
      <div className="layout__viewer">
        <ViewerFrame ref={iframeRef} />
      </div>
      <div className="layout__panel">
        <BridgeStatus state={state} />
        <ScoringPanel />
      </div>
    </div>
  );
}

export default App;

import { ViewerFrame } from './components/ViewerFrame';
import { ScoringPanel } from './components/ScoringPanel';
import './App.css';

function App() {
  return (
    <div className="layout">
      <div className="layout__viewer">
        <ViewerFrame />
      </div>
      <div className="layout__panel">
        <ScoringPanel />
      </div>
    </div>
  );
}

export default App;

import { UI } from '../ui-strings';

export function ScoringPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '18px', margin: '0 0 16px' }}>{UI.appTitle}</h1>
      {/* Disabled for now; row creation logic is added in a later slice. */}
      <button type="button" disabled>
        {UI.addMeasurement}
      </button>
      <p style={{ color: '#666' }}>{UI.emptyHint}</p>
      <div style={{ marginTop: 'auto', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
        {UI.total}: —
      </div>
    </div>
  );
}

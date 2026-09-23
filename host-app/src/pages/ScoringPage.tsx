import type { JSX } from 'react';
import { ScoringPanel } from '@app/components/ScoringPanel';
import { ViewerFrame } from '@app/components/ViewerFrame';

export const ScoringPage = (): JSX.Element => (
  <div className="layout">
    <div className="layout__viewer">
      <ViewerFrame />
    </div>
    <div className="layout__panel">
      <ScoringPanel />
    </div>
  </div>
);

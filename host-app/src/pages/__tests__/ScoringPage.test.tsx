import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoringPage } from '@app/pages/ScoringPage';
import { t } from '@app/i18n';
import { viewerUrl } from '@app/config';

describe('ScoringPage', () => {
  it('renders the heading, the add button and the viewer iframe', () => {
    render(<ScoringPage />);

    expect(screen.getByRole('heading', { name: t.appTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.addMeasurement })).toBeInTheDocument();

    const iframe = screen.getByTitle<HTMLIFrameElement>(t.viewerFrameTitle);
    expect(iframe.src).toBe(viewerUrl());

    expect(screen.getByText(new RegExp(t.bridgeNotReady))).toBeInTheDocument();
  });
});

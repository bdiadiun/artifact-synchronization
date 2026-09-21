import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '@app/App';
import { t } from '@app/i18n';
import { viewerUrl } from '@app/config';

describe('App', () => {
  it('renders the heading, the add button and the viewer iframe', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: t.appTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.addMeasurement })).toBeInTheDocument();

    const iframe = screen.getByTitle<HTMLIFrameElement>(t.viewerFrameTitle);
    expect(iframe.src).toBe(viewerUrl());

    expect(screen.getByText(new RegExp(t.bridgeNotReady))).toBeInTheDocument();
  });
});

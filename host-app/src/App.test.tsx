import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { UI } from './ui-strings';
import { viewerUrl } from './config';

describe('App', () => {
  it('renders the heading, the add button and the viewer iframe', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: UI.appTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: UI.addMeasurement })).toBeInTheDocument();

    const iframe = screen.getByTitle<HTMLIFrameElement>(UI.viewerFrameTitle);
    expect(iframe.src).toBe(viewerUrl());

    expect(screen.getByText(new RegExp(UI.bridgeNotReady))).toBeInTheDocument();
  });
});
